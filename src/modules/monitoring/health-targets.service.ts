import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import yaml from 'js-yaml';
import { z } from 'zod';

const healthTargetSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,32}$/),
  displayName: z.string().trim().min(1),
  url: z.string().trim().url(),
  method: z.enum(['GET', 'HEAD']).default('GET'),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  timeoutMs: z.number().int().min(500).max(30_000).default(5000),
  enabled: z.boolean().default(true),
});

const healthTargetsConfigSchema = z.object({
  targets: z.array(healthTargetSchema).default([]),
});

export type HealthTargetSummary = z.infer<typeof healthTargetSchema>;

export type HealthTargetsOverview = {
  configPath: string;
  fileExists: boolean;
  enabledTargetCount: number;
  disabledTargetCount: number;
  targets: HealthTargetSummary[];
};

@Injectable()
export class HealthTargetsService {
  constructor(private readonly configService: ConfigService) {}

  async getOverview(): Promise<HealthTargetsOverview> {
    const config = await this.loadConfig();

    return {
      configPath: config.configPath,
      fileExists: config.fileExists,
      enabledTargetCount: config.targets.filter((target) => target.enabled)
        .length,
      disabledTargetCount: config.targets.filter((target) => !target.enabled)
        .length,
      targets: config.targets,
    };
  }

  private async loadConfig(): Promise<{
    configPath: string;
    fileExists: boolean;
    targets: HealthTargetSummary[];
  }> {
    const configPath = this.configService.get<string>(
      'paths.healthTargetsConfig',
      '/app/config/health-targets.yaml',
    );

    try {
      const rawContent = await readFile(configPath, 'utf8');
      const parsedYaml = yaml.load(rawContent);
      const parsedConfig = healthTargetsConfigSchema.parse(parsedYaml);
      const targets = [...parsedConfig.targets].sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      );

      return {
        configPath,
        fileExists: true,
        targets,
      };
    } catch (error) {
      if (isMissingFileError(error)) {
        return {
          configPath,
          fileExists: false,
          targets: [],
        };
      }

      throw error;
    }
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

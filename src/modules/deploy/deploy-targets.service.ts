import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import yaml from 'js-yaml';
import { z } from 'zod';

const deployTargetSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,32}$/),
  displayName: z.string().trim().min(1),
  workingDirectory: z.string().trim().min(1),
  repositoryUrl: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  composeFile: z.string().trim().min(1),
  composeProject: z.string().trim().min(1),
  healthTargetName: z.string().trim().min(1).optional(),
  enabled: z.boolean().default(true),
});

const deployTargetsConfigSchema = z.object({
  targets: z.array(deployTargetSchema).default([]),
});

export type DeployTargetSummary = z.infer<typeof deployTargetSchema>;

export type DeployOverview = {
  configPath: string;
  fileExists: boolean;
  enabledTargetCount: number;
  disabledTargetCount: number;
  targets: DeployTargetSummary[];
};

@Injectable()
export class DeployTargetsService {
  constructor(private readonly configService: ConfigService) {}

  async getOverview(): Promise<DeployOverview> {
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

  async getEnabledTargetByName(name: string): Promise<DeployTargetSummary> {
    const config = await this.loadConfig();
    const target = config.targets.find((item) => item.name === name);

    if (!target) {
      throw new Error(`Deployment target "${name}" is not configured.`);
    }

    if (!target.enabled) {
      throw new Error(`Deployment target "${name}" is disabled.`);
    }

    return target;
  }

  private async loadConfig(): Promise<{
    configPath: string;
    fileExists: boolean;
    targets: DeployTargetSummary[];
  }> {
    const configPath = this.configService.get<string>(
      'paths.deployTargetsConfig',
      '/app/config/deploy-targets.yaml',
    );

    try {
      const rawContent = await readFile(configPath, 'utf8');
      const parsedYaml = yaml.load(rawContent);
      const parsedConfig = deployTargetsConfigSchema.parse(parsedYaml);
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

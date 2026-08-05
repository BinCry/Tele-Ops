import { Injectable } from '@nestjs/common';
import { DeploymentRunStatus, HealthCheckStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { HealthTargetsService } from 'src/modules/monitoring/health-targets.service';
import { HttpHealthGateway } from 'src/modules/monitoring/http-health.gateway';
import {
  DeployTargetSummary,
  DeployTargetsService,
} from './deploy-targets.service';
import { SafeProcessRunner } from './safe-process-runner.service';

export type DeploymentExecutionResult = {
  targetName: string;
  previousCommit: string;
  deployedCommit: string;
  outputSummary: string;
};

@Injectable()
export class DeploymentService {
  constructor(
    private readonly deployTargetsService: DeployTargetsService,
    private readonly prismaService: PrismaService,
    private readonly safeProcessRunner: SafeProcessRunner,
    private readonly healthTargetsService: HealthTargetsService,
    private readonly httpHealthGateway: HttpHealthGateway,
  ) {}

  async runDeployment(
    targetName: string,
    triggeredById: string,
  ): Promise<DeploymentExecutionResult> {
    const target =
      await this.deployTargetsService.getEnabledTargetByName(targetName);
    const persistedTarget = await this.prismaService.deploymentTarget.upsert({
      where: {
        name: target.name,
      },
      update: {
        displayName: target.displayName,
        workingDirectory: target.workingDirectory,
        repositoryUrl: target.repositoryUrl,
        branch: target.branch,
        composeFile: target.composeFile,
        composeProject: target.composeProject,
        healthTargetName: target.healthTargetName ?? null,
        enabled: target.enabled,
      },
      create: {
        name: target.name,
        displayName: target.displayName,
        workingDirectory: target.workingDirectory,
        repositoryUrl: target.repositoryUrl,
        branch: target.branch,
        composeFile: target.composeFile,
        composeProject: target.composeProject,
        healthTargetName: target.healthTargetName ?? null,
        enabled: target.enabled,
      },
    });
    const activeRun = await this.prismaService.deploymentRun.findFirst({
      where: {
        targetId: persistedTarget.id,
        status: DeploymentRunStatus.RUNNING,
      },
      select: {
        id: true,
      },
    });

    if (activeRun) {
      throw new Error(
        `Deployment target "${target.displayName}" already has a running deployment.`,
      );
    }

    const deploymentRun = await this.prismaService.deploymentRun.create({
      data: {
        targetId: persistedTarget.id,
        triggeredById,
        status: DeploymentRunStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const previousCommit = await this.readGitCommit(target.workingDirectory);

      const commandOutputs: string[] = [];
      commandOutputs.push(
        await this.runAndCollect(
          'git',
          ['fetch', 'origin', target.branch],
          target,
        ),
      );
      commandOutputs.push(
        await this.runAndCollect('git', ['checkout', target.branch], target),
      );
      commandOutputs.push(
        await this.runAndCollect(
          'git',
          ['pull', '--ff-only', 'origin', target.branch],
          target,
        ),
      );

      const composeFilePath = this.safeProcessRunner.resolvePathWithinDirectory(
        target.workingDirectory,
        target.composeFile,
      );
      commandOutputs.push(
        await this.runAndCollect(
          'docker',
          [
            'compose',
            '-f',
            composeFilePath,
            '-p',
            target.composeProject,
            'up',
            '-d',
            '--build',
          ],
          target,
        ),
      );
      commandOutputs.push(await this.runPostDeployHealthCheck(target));

      const deployedCommit = await this.readGitCommit(target.workingDirectory);
      const outputSummary = summarizeOutput(commandOutputs.join('\n'));

      await this.prismaService.deploymentRun.update({
        where: {
          id: deploymentRun.id,
        },
        data: {
          status: DeploymentRunStatus.SUCCESS,
          previousCommit,
          deployedCommit,
          requestedCommit: target.branch,
          outputSummary,
          finishedAt: new Date(),
        },
      });

      return {
        targetName: target.displayName,
        previousCommit,
        deployedCommit,
        outputSummary,
      };
    } catch (error) {
      await this.prismaService.deploymentRun.update({
        where: {
          id: deploymentRun.id,
        },
        data: {
          status: DeploymentRunStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown deploy error',
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async readGitCommit(workingDirectory: string): Promise<string> {
    const result = await this.safeProcessRunner.run(
      'git',
      ['rev-parse', 'HEAD'],
      workingDirectory,
    );

    return result.stdout.trim();
  }

  private async runAndCollect(
    executable: string,
    args: string[],
    target: DeployTargetSummary,
  ): Promise<string> {
    const result = await this.safeProcessRunner.run(
      executable,
      args,
      target.workingDirectory,
    );

    return [result.stdout.trim(), result.stderr.trim()]
      .filter((value) => value.length > 0)
      .join('\n');
  }

  private async runPostDeployHealthCheck(
    target: DeployTargetSummary,
  ): Promise<string> {
    if (!target.healthTargetName) {
      return 'Health check skipped: no health target configured.';
    }

    const healthTarget = await this.healthTargetsService.getEnabledTargetByName(
      target.healthTargetName,
    );
    const probeResult = await this.httpHealthGateway.checkTarget(healthTarget);

    if (probeResult.status !== HealthCheckStatus.HEALTHY) {
      throw new Error(
        `Health check "${healthTarget.displayName}" failed after deploy: ${probeResult.errorMessage ?? 'service is not healthy'}`,
      );
    }

    return `Health check "${healthTarget.displayName}" passed (HTTP ${probeResult.statusCode ?? 'n/a'}, ${probeResult.responseTimeMs}ms).`;
  }
}

function summarizeOutput(value: string): string {
  if (value.length <= 4000) {
    return value;
  }

  return value.slice(value.length - 4000);
}

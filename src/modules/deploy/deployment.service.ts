import { Injectable } from '@nestjs/common';
import { DeploymentRunStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
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
}

function summarizeOutput(value: string): string {
  if (value.length <= 4000) {
    return value;
  }

  return value.slice(value.length - 4000);
}

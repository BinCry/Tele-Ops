import { HealthCheckStatus } from '@prisma/client';
import { HealthTargetsService } from 'src/modules/monitoring/health-targets.service';
import { HttpHealthGateway } from 'src/modules/monitoring/http-health.gateway';
import { DeploymentService } from './deployment.service';
import {
  SafeProcessResult,
  SafeProcessRunner,
} from './safe-process-runner.service';

describe('DeploymentService', () => {
  it('runs a configured deployment, validates health, and stores a successful run', async () => {
    const deployTargetsService = {
      getEnabledTargetByName: jest.fn().mockResolvedValue({
        name: 'teleops-prod',
        displayName: 'TeleOps Production',
        workingDirectory: '/opt/teleops',
        repositoryUrl: 'https://github.com/BinCry/Tele-Ops.git',
        branch: 'main',
        composeFile: 'docker-compose.production.yml',
        composeProject: 'teleops',
        healthTargetName: 'teleops-http',
        enabled: true,
      }),
    };
    const prismaService = {
      deploymentTarget: {
        upsert: jest.fn().mockResolvedValue({
          id: 'target-1',
        }),
      },
      deploymentRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'run-1',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const healthTargetsService: Pick<
      HealthTargetsService,
      'getEnabledTargetByName'
    > = {
      getEnabledTargetByName: jest.fn().mockResolvedValue({
        name: 'teleops-http',
        displayName: 'TeleOps HTTP',
        url: 'https://teleops.example.com/health',
        method: 'GET',
        expectedStatus: 200,
        timeoutMs: 4000,
        enabled: true,
      }),
    };
    const httpHealthGateway: Pick<HttpHealthGateway, 'checkTarget'> = {
      checkTarget: jest.fn().mockResolvedValue({
        status: HealthCheckStatus.HEALTHY,
        responseTimeMs: 150,
        statusCode: 200,
        errorMessage: null,
      }),
    };
    const safeProcessRunner: Pick<
      SafeProcessRunner,
      'run' | 'resolvePathWithinDirectory'
    > = {
      run: jest
        .fn<Promise<SafeProcessResult>, [string, string[], string]>()
        .mockResolvedValueOnce({ stdout: 'abc123\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'fetch ok\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'checkout ok\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'pull ok\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'compose ok\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'def456\n', stderr: '' }),
      resolvePathWithinDirectory: jest
        .fn<string, [string, string]>()
        .mockReturnValue('/opt/teleops/docker-compose.production.yml'),
    };

    const service = new DeploymentService(
      deployTargetsService as never,
      prismaService as never,
      safeProcessRunner,
      healthTargetsService as unknown as HealthTargetsService,
      httpHealthGateway,
    );

    await expect(
      service.runDeployment('teleops-prod', 'user-1'),
    ).resolves.toEqual({
      targetName: 'TeleOps Production',
      previousCommit: 'abc123',
      deployedCommit: 'def456',
      outputSummary:
        'fetch ok\ncheckout ok\npull ok\ncompose ok\nHealth check "TeleOps HTTP" passed (HTTP 200, 150ms).',
    });
    expect(prismaService.deploymentRun.update).toHaveBeenCalled();
  });

  it('blocks a deployment when the target already has a running execution', async () => {
    const deployTargetsService = {
      getEnabledTargetByName: jest.fn().mockResolvedValue({
        name: 'teleops-prod',
        displayName: 'TeleOps Production',
        workingDirectory: '/opt/teleops',
        repositoryUrl: 'https://github.com/BinCry/Tele-Ops.git',
        branch: 'main',
        composeFile: 'docker-compose.production.yml',
        composeProject: 'teleops',
        healthTargetName: undefined,
        enabled: true,
      }),
    };
    const prismaService = {
      deploymentTarget: {
        upsert: jest.fn().mockResolvedValue({
          id: 'target-1',
        }),
      },
      deploymentRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'run-active',
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const safeProcessRunner: Pick<
      SafeProcessRunner,
      'run' | 'resolvePathWithinDirectory'
    > = {
      run: jest.fn(),
      resolvePathWithinDirectory: jest.fn(),
    };
    const healthTargetsService: Pick<
      HealthTargetsService,
      'getEnabledTargetByName'
    > = {
      getEnabledTargetByName: jest.fn(),
    };
    const httpHealthGateway: Pick<HttpHealthGateway, 'checkTarget'> = {
      checkTarget: jest.fn(),
    };
    const service = new DeploymentService(
      deployTargetsService as never,
      prismaService as never,
      safeProcessRunner,
      healthTargetsService as unknown as HealthTargetsService,
      httpHealthGateway,
    );

    await expect(
      service.runDeployment('teleops-prod', 'user-1'),
    ).rejects.toThrow(
      'Deployment target "TeleOps Production" already has a running deployment.',
    );
    expect(prismaService.deploymentRun.create).not.toHaveBeenCalled();
  });

  it('marks the deployment as failed when post-deploy health validation fails', async () => {
    const deployTargetsService = {
      getEnabledTargetByName: jest.fn().mockResolvedValue({
        name: 'teleops-prod',
        displayName: 'TeleOps Production',
        workingDirectory: '/opt/teleops',
        repositoryUrl: 'https://github.com/BinCry/Tele-Ops.git',
        branch: 'main',
        composeFile: 'docker-compose.production.yml',
        composeProject: 'teleops',
        healthTargetName: 'teleops-http',
        enabled: true,
      }),
    };
    const prismaService = {
      deploymentTarget: {
        upsert: jest.fn().mockResolvedValue({
          id: 'target-1',
        }),
      },
      deploymentRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'run-1',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const healthTargetsService: Pick<
      HealthTargetsService,
      'getEnabledTargetByName'
    > = {
      getEnabledTargetByName: jest.fn().mockResolvedValue({
        name: 'teleops-http',
        displayName: 'TeleOps HTTP',
        url: 'https://teleops.example.com/health',
        method: 'GET',
        expectedStatus: 200,
        timeoutMs: 4000,
        enabled: true,
      }),
    };
    const httpHealthGateway: Pick<HttpHealthGateway, 'checkTarget'> = {
      checkTarget: jest.fn().mockResolvedValue({
        status: HealthCheckStatus.DOWN,
        responseTimeMs: 120,
        statusCode: null,
        errorMessage: 'connect ECONNREFUSED',
      }),
    };
    const safeProcessRunner: Pick<
      SafeProcessRunner,
      'run' | 'resolvePathWithinDirectory'
    > = {
      run: jest
        .fn<Promise<SafeProcessResult>, [string, string[], string]>()
        .mockResolvedValueOnce({ stdout: 'abc123\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'fetch ok\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'checkout ok\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'pull ok\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'compose ok\n', stderr: '' }),
      resolvePathWithinDirectory: jest
        .fn<string, [string, string]>()
        .mockReturnValue('/opt/teleops/docker-compose.production.yml'),
    };
    const service = new DeploymentService(
      deployTargetsService as never,
      prismaService as never,
      safeProcessRunner,
      healthTargetsService as unknown as HealthTargetsService,
      httpHealthGateway,
    );

    await expect(
      service.runDeployment('teleops-prod', 'user-1'),
    ).rejects.toThrow(
      'Health check "TeleOps HTTP" failed after deploy: connect ECONNREFUSED',
    );
    const updateCall = prismaService.deploymentRun.update.mock.calls.at(0) as
      | [
          {
            data: {
              status: string;
            };
          },
        ]
      | undefined;

    expect(updateCall?.[0].data.status).toBe('FAILED');
  });
});

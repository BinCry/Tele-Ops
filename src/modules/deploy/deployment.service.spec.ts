import { DeploymentService } from './deployment.service';
import {
  SafeProcessResult,
  SafeProcessRunner,
} from './safe-process-runner.service';

describe('DeploymentService', () => {
  it('runs a configured deployment and stores a successful run', async () => {
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
        create: jest.fn().mockResolvedValue({
          id: 'run-1',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
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
    );

    await expect(
      service.runDeployment('teleops-prod', 'user-1'),
    ).resolves.toEqual({
      targetName: 'TeleOps Production',
      previousCommit: 'abc123',
      deployedCommit: 'def456',
      outputSummary: 'fetch ok\ncheckout ok\npull ok\ncompose ok',
    });
    expect(prismaService.deploymentRun.update).toHaveBeenCalled();
  });
});

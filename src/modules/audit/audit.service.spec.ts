import { AuditResult, Prisma } from '@prisma/client';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('redacts sensitive payload fields before persisting audit entries', async () => {
    const prismaService = {
      auditLog: {
        create: jest
          .fn<Promise<void>, [{ data: Prisma.AuditLogUncheckedCreateInput }]>()
          .mockResolvedValue(undefined),
        findMany: jest.fn(),
      },
    };
    const service = new AuditService(prismaService as never);

    await service.record({
      actorUserId: 'user-1',
      action: 'telegram.deploy.request',
      resourceType: 'deployment_target',
      resourceId: 'teleops-prod',
      payloadJson: {
        token: 'raw-confirmation-token',
        nested: {
          apiKey: 'secret-key',
          safeValue: 'keep-me',
        },
        items: [
          {
            authorization: 'Bearer abc',
            label: 'visible',
          },
        ],
      } satisfies Prisma.InputJsonObject,
      result: AuditResult.STARTED,
    });

    const createCall = prismaService.auditLog.create.mock.calls[0]?.[0];

    expect(createCall).toMatchObject({
      data: {
        payloadJson: {
          token: '[REDACTED]',
          nested: {
            apiKey: '[REDACTED]',
            safeValue: 'keep-me',
          },
          items: [
            {
              authorization: '[REDACTED]',
              label: 'visible',
            },
          ],
        },
      },
    });
  });

  it('returns recent audit entries with actor display names', async () => {
    const prismaService = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            action: 'telegram.backup.execute',
            resourceType: 'postgres_backup',
            resourceId: 'backup-1',
            result: AuditResult.SUCCESS,
            createdAt: new Date('2026-08-05T08:00:00.000Z'),
            actorUser: {
              displayName: 'Owner User',
            },
          },
        ]),
      },
    };
    const service = new AuditService(prismaService as never);

    await expect(service.listRecent()).resolves.toEqual([
      {
        action: 'telegram.backup.execute',
        resourceType: 'postgres_backup',
        resourceId: 'backup-1',
        result: AuditResult.SUCCESS,
        createdAt: new Date('2026-08-05T08:00:00.000Z'),
        actorDisplayName: 'Owner User',
      },
    ]);
  });
});

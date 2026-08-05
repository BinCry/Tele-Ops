import { ConfigService } from '@nestjs/config';
import { ActionRequestStatus, Prisma } from '@prisma/client';
import { ActionRequestService } from './action-request.service';

describe('ActionRequestService', () => {
  let prismaService: {
    actionRequest: {
      create: jest.Mock<
        Promise<unknown>,
        [{ data: Prisma.ActionRequestUncheckedCreateInput }]
      >;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
  };
  let configService: {
    get: jest.Mock;
  };
  let service: ActionRequestService;

  beforeEach(() => {
    prismaService = {
      actionRequest: {
        create: jest.fn<
          Promise<unknown>,
          [{ data: Prisma.ActionRequestUncheckedCreateInput }]
        >(),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };
    configService = {
      get: jest.fn().mockReturnValue(60),
    };
    service = new ActionRequestService(
      prismaService as never,
      configService as unknown as ConfigService,
    );
  });

  it('creates a pending request with a ttl from config', async () => {
    prismaService.actionRequest.create.mockResolvedValue({
      id: 'request-1',
      token: 'token-1',
    });

    await service.createPendingRequest({
      actorUserId: 'user-1',
      actionType: 'docker.restart',
      resourceType: 'docker_container',
      resourceId: 'abc123',
      payloadJson: { containerName: 'teleops' },
    });

    const createArguments =
      prismaService.actionRequest.create.mock.calls[0]?.[0];

    expect(createArguments).toBeDefined();
    expect(createArguments?.data.actorUserId).toBe('user-1');
    expect(createArguments?.data.actionType).toBe('docker.restart');
    expect(createArguments?.data.resourceType).toBe('docker_container');
    expect(createArguments?.data.resourceId).toBe('abc123');
  });

  it('marks expired requests when a token is no longer valid', async () => {
    prismaService.actionRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      actorUserId: 'user-1',
      status: ActionRequestStatus.PENDING,
      expiresAt: new Date(Date.now() - 10_000),
    });

    await expect(service.resolveForActor('token-1', 'user-1')).resolves.toEqual(
      {
        status: 'expired',
      },
    );

    const updateArguments =
      prismaService.actionRequest.update.mock.calls[0]?.[0];

    expect(updateArguments).toBeDefined();
    expect(updateArguments).toMatchObject({
      data: {
        status: ActionRequestStatus.EXPIRED,
      },
    });
  });

  it('rejects tokens owned by another actor', async () => {
    prismaService.actionRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      actorUserId: 'user-2',
      status: ActionRequestStatus.PENDING,
      expiresAt: new Date(Date.now() + 10_000),
    });

    await expect(service.resolveForActor('token-1', 'user-1')).resolves.toEqual(
      {
        status: 'wrong_actor',
      },
    );
  });
});

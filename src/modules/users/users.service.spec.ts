import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('creates or refreshes a pending Telegram user request', async () => {
    const prismaService = {
      user: {
        upsert: jest.fn().mockResolvedValue({
          id: 'user-1',
          telegramUserId: '999',
          displayName: 'Guest User',
          role: UserRole.VIEWER,
          status: UserStatus.PENDING,
        }),
      },
    };
    const service = new UsersService(prismaService as never);

    await expect(
      service.createPendingTelegramUser({
        id: 999,
        firstName: 'Guest',
        lastName: 'User',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        telegramUserId: '999',
        status: UserStatus.PENDING,
      }),
    );
    const upsertCall = prismaService.user.upsert.mock.calls.at(0) as
      | [
          {
            create: {
              role: UserRole;
              status: UserStatus;
            };
          },
        ]
      | undefined;

    expect(upsertCall?.[0].create.role).toBe(UserRole.VIEWER);
    expect(upsertCall?.[0].create.status).toBe(UserStatus.PENDING);
  });

  it('updates a user status when the target is manageable', async () => {
    const prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-2',
          telegramUserId: '1000',
          role: UserRole.VIEWER,
          status: UserStatus.PENDING,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'user-2',
          telegramUserId: '1000',
          role: UserRole.VIEWER,
          status: UserStatus.ACTIVE,
        }),
      },
    };
    const service = new UsersService(prismaService as never);

    await expect(
      service.updateUserStatus('user-2', UserStatus.ACTIVE),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'user-2',
        status: UserStatus.ACTIVE,
      }),
    );
  });

  it('rejects disabling the owner user', async () => {
    const prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'owner-1',
          telegramUserId: '123456789',
          role: UserRole.OWNER,
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn(),
      },
    };
    const service = new UsersService(prismaService as never);

    await expect(
      service.updateUserStatus('owner-1', UserStatus.DISABLED),
    ).rejects.toThrow('Owner user cannot be disabled.');
    expect(prismaService.user.update).not.toHaveBeenCalled();
  });

  it('creates or upgrades a managed user with the requested role', async () => {
    const prismaService = {
      user: {
        upsert: jest.fn().mockResolvedValue({
          id: 'user-3',
          telegramUserId: '6187399924',
          displayName: 'Telegram 6187399924',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        }),
      },
    };
    const service = new UsersService(prismaService as never);

    await expect(
      service.createManagedUser({
        telegramUserId: '6187399924',
        role: UserRole.OPERATOR,
        createdById: 'owner-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        telegramUserId: '6187399924',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      }),
    );
  });

  it('updates the role of an existing managed user', async () => {
    const prismaService = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-4',
          telegramUserId: '6187399924',
          role: UserRole.VIEWER,
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'user-4',
          telegramUserId: '6187399924',
          displayName: 'Telegram 6187399924',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        }),
      },
    };
    const service = new UsersService(prismaService as never);

    await expect(
      service.updateManagedUserRole('6187399924', UserRole.OPERATOR),
    ).resolves.toEqual(
      expect.objectContaining({
        telegramUserId: '6187399924',
        role: UserRole.OPERATOR,
      }),
    );
  });
});

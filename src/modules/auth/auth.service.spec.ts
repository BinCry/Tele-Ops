import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from 'src/modules/users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    ensureOwnerUser: jest.Mock;
    findByTelegramUserId: jest.Mock;
    touchTelegramProfile: jest.Mock;
  };

  beforeAll(() => {
    process.env.TELEGRAM_OWNER_USER_ID = '123456789';
  });

  beforeEach(async () => {
    usersService = {
      ensureOwnerUser: jest.fn(),
      findByTelegramUserId: jest.fn(),
      touchTelegramProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('authorizes the owner and refreshes profile data', async () => {
    usersService.ensureOwnerUser.mockResolvedValue({
      id: 'user-1',
      telegramUserId: '123456789',
      displayName: 'Owner',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    });
    usersService.touchTelegramProfile.mockResolvedValue({
      id: 'user-1',
      telegramUserId: '123456789',
      displayName: 'Owner',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    });

    const result = await service.authorizeTelegramContext({
      from: {
        id: 123456789,
        first_name: 'Owner',
      },
    } as never);

    expect(result.status).toBe('authorized');
  });

  it('returns unknown-user denial when no record exists', async () => {
    usersService.findByTelegramUserId.mockResolvedValue(null);

    const result = await service.authorizeTelegramContext({
      from: {
        id: 999,
        first_name: 'Guest',
      },
    } as never);

    expect(result).toEqual({
      status: 'unauthorized',
      telegramUserId: '999',
      reason: 'unknown_user',
      message:
        'Tài khoản Telegram này hiện chưa được cấp quyền truy cập TeleOps.',
    });
  });
});

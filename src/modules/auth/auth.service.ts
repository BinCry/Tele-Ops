import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { UsersService } from 'src/modules/users/users.service';
import { TelegramBotContext } from 'src/telegram/context/telegram-context';
import { TelegramAuthorizationResult } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async authorizeTelegramContext(
    context: TelegramBotContext,
  ): Promise<TelegramAuthorizationResult> {
    if (!context.from) {
      return {
        status: 'unauthorized',
        telegramUserId: 'unknown',
        reason: 'missing_identity',
        message: 'Không đọc được thông tin người dùng Telegram.',
      };
    }

    const profile = {
      id: context.from.id,
      username: context.from.username,
      firstName: context.from.first_name,
      lastName: context.from.last_name,
    };

    const ownerTelegramUserId = this.configService.getOrThrow<string>(
      'TELEGRAM_OWNER_USER_ID',
    );
    const telegramUserId = String(profile.id);

    const user =
      telegramUserId === ownerTelegramUserId
        ? await this.usersService.ensureOwnerUser(profile)
        : await this.usersService.findByTelegramUserId(telegramUserId);

    if (!user) {
      await this.usersService.createPendingTelegramUser(profile);

      return {
        status: 'unauthorized',
        telegramUserId,
        reason: 'pending',
        message: 'Tài khoản của bạn đang chờ được phê duyệt.',
      };
    }

    if (user.status === UserStatus.DISABLED) {
      await this.usersService.touchTelegramProfile(user.id, profile);

      return {
        status: 'unauthorized',
        telegramUserId,
        reason: 'disabled',
        message: 'Tài khoản của bạn đang bị vô hiệu hóa.',
      };
    }

    if (user.status === UserStatus.PENDING) {
      await this.usersService.touchTelegramProfile(user.id, profile);

      return {
        status: 'unauthorized',
        telegramUserId,
        reason: 'pending',
        message: 'Tài khoản của bạn đang chờ được phê duyệt.',
      };
    }

    const freshUser = await this.usersService.touchTelegramProfile(
      user.id,
      profile,
    );

    return {
      status: 'authorized',
      user: freshUser,
    };
  }
}

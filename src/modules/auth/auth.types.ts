import { User } from '@prisma/client';

export type TelegramAuthorizationResult =
  | {
      status: 'authorized';
      user: User;
    }
  | {
      status: 'unauthorized';
      telegramUserId: string;
      reason: 'unknown_user' | 'disabled' | 'pending' | 'missing_identity';
      message: string;
    };

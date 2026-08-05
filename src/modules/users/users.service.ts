import { Injectable } from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

export type TelegramProfile = {
  id: number;
  username?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
};

export type UserSummary = Pick<
  User,
  'displayName' | 'telegramUserId' | 'role' | 'status' | 'lastSeenAt'
>;

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async findByTelegramUserId(telegramUserId: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        telegramUserId,
      },
    });
  }

  async ensureOwnerUser(profile: TelegramProfile): Promise<User> {
    await this.prismaService.user.updateMany({
      where: {
        role: UserRole.OWNER,
        NOT: {
          telegramUserId: String(profile.id),
        },
      },
      data: {
        role: UserRole.ADMIN,
      },
    });

    return this.prismaService.user.upsert({
      where: {
        telegramUserId: String(profile.id),
      },
      update: {
        displayName: this.buildDisplayName(profile),
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        lastSeenAt: new Date(),
      },
      create: {
        telegramUserId: String(profile.id),
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        displayName: this.buildDisplayName(profile),
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        lastSeenAt: new Date(),
      },
    });
  }

  async touchTelegramProfile(
    userId: string,
    profile: TelegramProfile,
  ): Promise<User> {
    return this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        displayName: this.buildDisplayName(profile),
        lastSeenAt: new Date(),
      },
    });
  }

  async listUserSummaries(limit = 8): Promise<UserSummary[]> {
    return this.prismaService.user.findMany({
      orderBy: [
        {
          role: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
      take: limit,
      select: {
        displayName: true,
        telegramUserId: true,
        role: true,
        status: true,
        lastSeenAt: true,
      },
    });
  }

  private buildDisplayName(profile: TelegramProfile): string {
    const fullName = [profile.firstName, profile.lastName]
      .filter((value) => Boolean(value))
      .join(' ')
      .trim();

    if (fullName.length > 0) {
      return fullName;
    }

    if (profile.username && profile.username.length > 0) {
      return `@${profile.username}`;
    }

    return `Telegram ${profile.id}`;
  }
}

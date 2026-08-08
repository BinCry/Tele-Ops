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

export type ManagedUserRole =
  | typeof UserRole.ADMIN
  | typeof UserRole.OPERATOR
  | typeof UserRole.VIEWER;

export type ManagedUserInput = {
  telegramUserId: string;
  role: ManagedUserRole;
  createdById: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async createPendingTelegramUser(profile: TelegramProfile): Promise<User> {
    return this.prismaService.user.upsert({
      where: {
        telegramUserId: String(profile.id),
      },
      update: {
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        displayName: this.buildDisplayName(profile),
        role: UserRole.VIEWER,
        status: UserStatus.PENDING,
        lastSeenAt: new Date(),
      },
      create: {
        telegramUserId: String(profile.id),
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        displayName: this.buildDisplayName(profile),
        role: UserRole.VIEWER,
        status: UserStatus.PENDING,
        lastSeenAt: new Date(),
      },
    });
  }

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

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error(`User "${userId}" was not found.`);
    }

    if (user.role === UserRole.OWNER && status !== UserStatus.ACTIVE) {
      throw new Error('Owner user cannot be disabled.');
    }

    if (user.status === status) {
      return user;
    }

    return this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        status,
      },
    });
  }

  async createManagedUser(input: ManagedUserInput): Promise<User> {
    return this.prismaService.user.upsert({
      where: {
        telegramUserId: input.telegramUserId,
      },
      update: {
        role: input.role,
        status: UserStatus.ACTIVE,
        displayName: `Telegram ${input.telegramUserId}`,
      },
      create: {
        telegramUserId: input.telegramUserId,
        displayName: `Telegram ${input.telegramUserId}`,
        role: input.role,
        status: UserStatus.ACTIVE,
        createdById: input.createdById,
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

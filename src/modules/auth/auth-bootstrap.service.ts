import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class AuthBootstrapService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }

    const ownerId = Number(
      this.configService.getOrThrow<string>('TELEGRAM_OWNER_USER_ID'),
    );

    const owner = await this.usersService.ensureOwnerUser({
      id: ownerId,
      firstName: 'TeleOps',
      lastName: 'Owner',
    });

    this.logger.info(
      { ownerUserId: owner.telegramUserId },
      'Owner bootstrap ensured.',
    );
  }
}

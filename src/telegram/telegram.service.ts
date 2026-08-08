import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { Telegraf } from 'telegraf';
import { TelegramBotContext } from './context/telegram-context';
import { TelegramUpdate } from './telegram.update';

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
  private static readonly LAUNCH_TIMEOUT_MS = 15_000;
  private bot?: Telegraf<TelegramBotContext>;
  private launchPromise?: Promise<void>;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramUpdate: TelegramUpdate,
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return;
    }

    if (this.configService.get<string>('TELEGRAM_MODE') !== 'polling') {
      this.logger.warn('Telegram mode is not polling; bot launch skipped.');
      return;
    }

    this.bot = new Telegraf<TelegramBotContext>(
      this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
    );

    this.registerHandlers(this.bot);

    this.bot.catch(async (error: unknown, context: TelegramBotContext) => {
      this.logger.error(
        { err: error, updateId: context.update.update_id },
        'Telegram bot handler crashed.',
      );

      if ('answerCbQuery' in context) {
        try {
          await context.answerCbQuery('Đã xảy ra lỗi, vui lòng thử lại.');
        } catch {
          this.telegramUpdate.logUnhandledError(error);
        }
      }
    });

    this.launchPromise = this.launchBotInBackground();
  }

  onApplicationShutdown(): void {
    this.bot?.stop('Nest shutdown');
  }

  private async launchBotInBackground(): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      await Promise.race([
        this.bot.launch({
          dropPendingUpdates: true,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Telegram bot launch timed out after ${TelegramService.LAUNCH_TIMEOUT_MS}ms.`,
              ),
            );
          }, TelegramService.LAUNCH_TIMEOUT_MS);
        }),
      ]);

      this.logger.info('Telegram bot launched in polling mode.');
    } catch (error) {
      this.logger.error(
        { err: error },
        'Telegram bot launch failed; HTTP service will remain available.',
      );
    }
  }

  private registerHandlers(bot: Telegraf<TelegramBotContext>): void {
    bot.start((context) => this.telegramUpdate.handleStart(context));
    bot.command('adduser', (context) =>
      this.telegramUpdate.handleAddUserCommand(context),
    );
    bot.command('setrole', (context) =>
      this.telegramUpdate.handleSetRoleCommand(context),
    );
    bot.command('cancel', (context) =>
      this.telegramUpdate.handleCancel(context),
    );
    bot.on('callback_query', async (context) => {
      const callbackData =
        'data' in context.callbackQuery ? context.callbackQuery.data : '';

      await this.telegramUpdate.handleCallback(context, callbackData);
    });
  }
}

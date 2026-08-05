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
  private bot?: Telegraf<TelegramBotContext>;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramUpdate: TelegramUpdate,
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
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

    await this.bot.launch({
      dropPendingUpdates: true,
    });

    this.logger.info('Telegram bot launched in polling mode.');
  }

  onApplicationShutdown(): void {
    this.bot?.stop('Nest shutdown');
  }

  private registerHandlers(bot: Telegraf<TelegramBotContext>): void {
    bot.start((context) => this.telegramUpdate.handleStart(context));
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

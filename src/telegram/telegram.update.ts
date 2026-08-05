import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  TELEGRAM_CALLBACKS,
  TelegramCallback,
} from './callbacks/callback-data';
import { TelegramBotContext } from './context/telegram-context';
import { TelegramNavigationService } from './navigation/navigation.service';
import { TelegramMenuRenderer } from './renderers/menu-renderer.service';

const FEATURE_LABELS: Record<TelegramCallback, string> = {
  'nav:home': 'Home',
  'nav:refresh': 'Home',
  'nav:dashboard': 'Dashboard',
  'nav:server': 'Server',
  'nav:docker': 'Docker',
  'nav:logs': 'Logs',
  'nav:deploy': 'Deploy',
  'nav:monitoring': 'Monitoring',
  'nav:users': 'Users',
  'nav:settings': 'Settings',
};

@Injectable()
export class TelegramUpdate {
  constructor(
    private readonly configService: ConfigService,
    private readonly navigationService: TelegramNavigationService,
    private readonly menuRenderer: TelegramMenuRenderer,
    private readonly logger: PinoLogger,
  ) {}

  async handleStart(context: TelegramBotContext): Promise<void> {
    const userId = String(context.from?.id ?? 'unknown');

    await this.menuRenderer.renderScreen(
      context,
      this.isOwner(userId)
        ? this.navigationService.buildOwnerHomeScreen()
        : this.navigationService.buildUnauthorizedScreen(userId),
    );
  }

  async handleCancel(context: TelegramBotContext): Promise<void> {
    await context.reply(
      '❌ Đã hủy thao tác hiện tại. Bạn có thể bắt đầu lại từ Home.',
      {
        parse_mode: 'HTML',
      },
    );

    await this.handleStart(context);
  }

  async handleCallback(
    context: TelegramBotContext,
    callbackData: string,
  ): Promise<void> {
    if (!this.isNavigationCallback(callbackData)) {
      await context.answerCbQuery('Tác vụ không hợp lệ.', {
        show_alert: true,
      });
      return;
    }

    if (!this.isOwner(String(context.from?.id ?? 'unknown'))) {
      await context.answerCbQuery('Bạn chưa được cấp quyền.', {
        show_alert: true,
      });
      await this.menuRenderer.renderScreen(
        context,
        this.navigationService.buildUnauthorizedScreen(
          String(context.from?.id ?? 'unknown'),
        ),
      );
      return;
    }

    if (
      callbackData === TELEGRAM_CALLBACKS.home ||
      callbackData === TELEGRAM_CALLBACKS.refresh
    ) {
      await context.answerCbQuery('Đang làm mới Home...');
      await this.menuRenderer.renderScreen(
        context,
        this.navigationService.buildOwnerHomeScreen(),
      );
      return;
    }

    await context.answerCbQuery('Tính năng đang được triển khai.');
    await this.menuRenderer.renderScreen(
      context,
      this.navigationService.buildFeaturePlaceholder(
        FEATURE_LABELS[callbackData],
      ),
    );
  }

  logUnhandledError(error: unknown): void {
    this.logger.error({ err: error }, 'Telegram update processing failed.');
  }

  private isOwner(userId: string): boolean {
    return (
      userId === this.configService.getOrThrow<string>('TELEGRAM_OWNER_USER_ID')
    );
  }

  private isNavigationCallback(value: string): value is TelegramCallback {
    return Object.values(TELEGRAM_CALLBACKS).includes(
      value as TelegramCallback,
    );
  }
}

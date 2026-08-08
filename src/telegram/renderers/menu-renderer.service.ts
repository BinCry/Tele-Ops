import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { TelegramBotContext } from '../context/telegram-context';

export type RenderedTelegramScreen = {
  text: string;
  keyboard: InlineKeyboardMarkup;
};

@Injectable()
export class TelegramMenuRenderer {
  async renderScreen(
    context: TelegramBotContext,
    screen: RenderedTelegramScreen,
  ): Promise<void> {
    const replyMarkup = {
      reply_markup: screen.keyboard,
      parse_mode: 'HTML' as const,
    };

    if ('callback_query' in context.update) {
      try {
        await context.editMessageText(screen.text, replyMarkup);
        return;
      } catch (error) {
        if (this.isMessageNotModifiedError(error)) {
          return;
        }

        await context.reply(screen.text, replyMarkup);
        return;
      }
    }

    await context.reply(screen.text, replyMarkup);
  }

  private isMessageNotModifiedError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.toLowerCase().includes('message is not modified');
  }
}

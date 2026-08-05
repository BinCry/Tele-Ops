import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { TELEGRAM_CALLBACKS } from '../callbacks/callback-data';

export function createOwnerHomeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📊 Dashboard', callback_data: TELEGRAM_CALLBACKS.dashboard },
        { text: '🖥 Server', callback_data: TELEGRAM_CALLBACKS.server },
      ],
      [
        { text: '🐳 Docker', callback_data: TELEGRAM_CALLBACKS.docker },
        { text: '📄 Logs', callback_data: TELEGRAM_CALLBACKS.logs },
      ],
      [
        { text: '🚀 Deploy', callback_data: TELEGRAM_CALLBACKS.deploy },
        { text: '📈 Monitoring', callback_data: TELEGRAM_CALLBACKS.monitoring },
      ],
      [
        { text: '👥 Users', callback_data: TELEGRAM_CALLBACKS.users },
        { text: '⚙️ Settings', callback_data: TELEGRAM_CALLBACKS.settings },
      ],
      [{ text: '🔄 Làm mới', callback_data: TELEGRAM_CALLBACKS.refresh }],
    ],
  };
}

export function createUnauthorizedKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🔄 Làm mới', callback_data: TELEGRAM_CALLBACKS.refresh }],
    ],
  };
}

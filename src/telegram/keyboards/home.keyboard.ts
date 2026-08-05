import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
} from 'telegraf/typings/core/types/typegram';

export function buildKeyboard(
  buttons: InlineKeyboardButton.CallbackButton[],
  trailingRows: InlineKeyboardButton.CallbackButton[][] = [],
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton.CallbackButton[][] = [];

  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }

  return {
    inline_keyboard: [...rows, ...trailingRows],
  };
}

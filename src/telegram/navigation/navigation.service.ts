import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import {
  createOwnerHomeKeyboard,
  createUnauthorizedKeyboard,
} from '../keyboards/home.keyboard';

export type TelegramScreen = {
  text: string;
  keyboard: InlineKeyboardMarkup;
};

@Injectable()
export class TelegramNavigationService {
  buildOwnerHomeScreen(): TelegramScreen {
    return {
      text: [
        '🏠 <b>TeleOps</b>',
        '',
        'Bot điều hành đã sẵn sàng.',
        'Chọn một khu vực để bắt đầu quản trị VPS và dịch vụ.',
      ].join('\n'),
      keyboard: createOwnerHomeKeyboard(),
    };
  }

  buildUnauthorizedScreen(userId: string): TelegramScreen {
    return {
      text: [
        '⚠️ <b>Chưa được cấp quyền</b>',
        '',
        'Tài khoản Telegram này hiện chưa được phép truy cập TeleOps.',
        `Telegram numeric user ID của bạn: <code>${userId}</code>`,
        'Hãy gửi ID này cho quản trị viên để được cấp quyền.',
      ].join('\n'),
      keyboard: createUnauthorizedKeyboard(),
    };
  }

  buildFeaturePlaceholder(featureLabel: string): TelegramScreen {
    return {
      text: [
        '🛠 <b>Đang xây dựng</b>',
        '',
        `Mục <b>${featureLabel}</b> đang được triển khai.`,
        'Bạn có thể quay lại Home hoặc chờ milestone tiếp theo.',
      ].join('\n'),
      keyboard: createOwnerHomeKeyboard(),
    };
  }
}

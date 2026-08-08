import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
} from 'telegraf/typings/core/types/typegram';
import { PERMISSIONS, Permission } from 'src/modules/rbac/permissions';
import { RbacService } from 'src/modules/rbac/rbac.service';
import {
  buildRefreshCallback,
  TELEGRAM_CALLBACKS,
  TelegramCallback,
} from '../callbacks/callback-data';
import { buildKeyboard } from '../keyboards/home.keyboard';

export type TelegramScreen = {
  text: string;
  keyboard: InlineKeyboardMarkup;
};

type HomeNavigationItem = {
  text: string;
  callback: TelegramCallback;
  permission: Permission;
};

const HOME_NAVIGATION_ITEMS: HomeNavigationItem[] = [
  {
    text: '📊 Dashboard',
    callback: TELEGRAM_CALLBACKS.dashboard,
    permission: PERMISSIONS.dashboardView,
  },
  {
    text: '🖥 Server',
    callback: TELEGRAM_CALLBACKS.server,
    permission: PERMISSIONS.serverView,
  },
  {
    text: '🐳 Docker',
    callback: TELEGRAM_CALLBACKS.docker,
    permission: PERMISSIONS.dockerView,
  },
  {
    text: '📄 Logs',
    callback: TELEGRAM_CALLBACKS.logs,
    permission: PERMISSIONS.logsView,
  },
  {
    text: '🚀 Deploy',
    callback: TELEGRAM_CALLBACKS.deploy,
    permission: PERMISSIONS.deployRun,
  },
  {
    text: '🗄 Database',
    callback: TELEGRAM_CALLBACKS.database,
    permission: PERMISSIONS.databaseView,
  },
  {
    text: '💾 Backup',
    callback: TELEGRAM_CALLBACKS.backup,
    permission: PERMISSIONS.backupRun,
  },
  {
    text: '📈 Monitoring',
    callback: TELEGRAM_CALLBACKS.monitoring,
    permission: PERMISSIONS.monitoringView,
  },
  {
    text: '👥 Users',
    callback: TELEGRAM_CALLBACKS.users,
    permission: PERMISSIONS.usersManage,
  },
  {
    text: '🧾 Audit',
    callback: TELEGRAM_CALLBACKS.audit,
    permission: PERMISSIONS.auditView,
  },
  {
    text: '⚙️ Settings',
    callback: TELEGRAM_CALLBACKS.settings,
    permission: PERMISSIONS.settingsManage,
  },
];

@Injectable()
export class TelegramNavigationService {
  constructor(private readonly rbacService: RbacService) {}

  buildHomeScreen(user: {
    displayName: string;
    role: UserRole;
  }): TelegramScreen {
    const buttons = HOME_NAVIGATION_ITEMS.filter((item) =>
      this.rbacService.hasPermission(user.role, item.permission),
    ).map<InlineKeyboardButton.CallbackButton>((item) => ({
      text: item.text,
      callback_data: item.callback,
    }));

    return {
      text: [
        '🏠 <b>TeleOps</b>',
        '',
        `Xin chào <b>${user.displayName}</b>.`,
        `Vai trò hiện tại: <b>${user.role}</b>.`,
        'Chọn một khu vực để bắt đầu quản trị VPS và dịch vụ.',
      ].join('\n'),
      keyboard: buildKeyboard(buttons, [
        [
          {
            text: '🔄 Làm mới',
            callback_data: buildRefreshCallback(TELEGRAM_CALLBACKS.home),
          },
        ],
      ]),
    };
  }

  buildUnauthorizedScreen(userId: string, message: string): TelegramScreen {
    return {
      text: [
        '⚠️ <b>Chưa được cấp quyền</b>',
        '',
        message,
        `Telegram numeric user ID của bạn: <code>${userId}</code>`,
        'Hãy gửi ID này cho quản trị viên để được cấp quyền.',
      ].join('\n'),
      keyboard: buildKeyboard(
        [],
        [
          [
            {
              text: '🔄 Làm mới',
              callback_data: buildRefreshCallback(TELEGRAM_CALLBACKS.home),
            },
          ],
        ],
      ),
    };
  }
}

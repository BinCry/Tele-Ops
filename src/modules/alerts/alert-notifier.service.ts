import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegram } from 'telegraf';

@Injectable()
export class AlertNotifierService {
  private readonly telegram: Telegram;

  constructor(private readonly configService: ConfigService) {
    const botToken =
      this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.telegram = new Telegram(botToken);
  }

  async notifyOpenAlert(input: {
    displayName: string;
    severity: 'info' | 'warning' | 'critical';
    summary: string;
  }): Promise<boolean> {
    const alertChatId = this.configService.get<string>(
      'telegram.alertChatId',
      '',
    );

    if (alertChatId.length === 0) {
      return false;
    }

    await this.telegram.sendMessage(
      alertChatId,
      [
        `${getSeverityEmoji(input.severity)} <b>Cảnh báo mới</b>`,
        '',
        `Rule: <b>${escapeHtml(input.displayName)}</b>`,
        `Chi tiết: ${escapeHtml(input.summary)}`,
      ].join('\n'),
      {
        parse_mode: 'HTML',
      },
    );

    return true;
  }

  async notifyResolvedAlert(input: {
    displayName: string;
    summary: string;
  }): Promise<boolean> {
    const alertChatId = this.configService.get<string>(
      'telegram.alertChatId',
      '',
    );

    if (alertChatId.length === 0) {
      return false;
    }

    await this.telegram.sendMessage(
      alertChatId,
      [
        '✅ <b>Cảnh báo đã hồi phục</b>',
        '',
        `Rule: <b>${escapeHtml(input.displayName)}</b>`,
        `Chi tiết: ${escapeHtml(input.summary)}`,
      ].join('\n'),
      {
        parse_mode: 'HTML',
      },
    );

    return true;
  }
}

function getSeverityEmoji(severity: 'info' | 'warning' | 'critical'): string {
  switch (severity) {
    case 'info':
      return '🔵';
    case 'warning':
      return '🟡';
    case 'critical':
      return '🔴';
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[<&>]/g, (currentCharacter) => {
    switch (currentCharacter) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return '&amp;';
    }
  });
}

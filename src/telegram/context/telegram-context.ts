import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';

export type TelegramBotContext = Context<Update>;

import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { TELEGRAM_CALLBACKS } from './callbacks/callback-data';
import { TelegramBotContext } from './context/telegram-context';
import { TelegramNavigationService } from './navigation/navigation.service';
import { TelegramMenuRenderer } from './renderers/menu-renderer.service';
import { TelegramUpdate } from './telegram.update';

function createMockContext(
  userId: number,
  mode: 'message' | 'callback' = 'message',
): {
  context: TelegramBotContext;
  replyMock: jest.Mock;
  editMessageTextMock: jest.Mock;
  answerCbQueryMock: jest.Mock;
} {
  const replyMock = jest.fn().mockResolvedValue(undefined);
  const editMessageTextMock = jest.fn().mockResolvedValue(undefined);
  const answerCbQueryMock = jest.fn().mockResolvedValue(undefined);

  const context = {
    from: { id: userId },
    update:
      mode === 'callback'
        ? { callback_query: { id: 'callback-id' } }
        : { message: { message_id: 1 } },
    reply: replyMock,
    editMessageText: editMessageTextMock,
    answerCbQuery: answerCbQueryMock,
  };

  return {
    context: context as unknown as TelegramBotContext,
    replyMock,
    editMessageTextMock,
    answerCbQueryMock,
  };
}

describe('TelegramUpdate', () => {
  let telegramUpdate: TelegramUpdate;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.APP_NAME = 'TeleOps Test';
    process.env.APP_TIMEZONE = 'Asia/Ho_Chi_Minh';
    process.env.LOG_LEVEL = 'silent';
    process.env.PORT = '3001';
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_OWNER_USER_ID = '123456789';
    process.env.DATABASE_URL =
      'postgresql://teleops:teleops@localhost:5432/teleops';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.DOCKER_HOST = 'unix:///var/run/docker.sock';
    process.env.DEPLOY_TARGETS_CONFIG_PATH = '/app/config/deploy-targets.yaml';
    process.env.HEALTH_TARGETS_CONFIG_PATH = '/app/config/health-targets.yaml';
    process.env.ALERT_RULES_CONFIG_PATH = '/app/config/alert-rules.yaml';
    process.env.BACKUP_DIRECTORY = '/data/backups';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        TelegramUpdate,
        TelegramNavigationService,
        TelegramMenuRenderer,
        {
          provide: PinoLogger,
          useValue: {
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    telegramUpdate = module.get<TelegramUpdate>(TelegramUpdate);
  });

  it('renders the owner home screen on /start', async () => {
    const { context, replyMock } = createMockContext(123456789);

    await telegramUpdate.handleStart(context);

    expect(replyMock).toHaveBeenCalledWith(
      expect.stringContaining('TeleOps'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('renders the unauthorized screen for unknown users', async () => {
    const { context, replyMock } = createMockContext(999999999);

    await telegramUpdate.handleStart(context);

    expect(replyMock).toHaveBeenCalledWith(
      expect.stringContaining('999999999'),
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('acknowledges callbacks and refreshes the owner home screen', async () => {
    const { context, answerCbQueryMock, editMessageTextMock } =
      createMockContext(123456789, 'callback');

    await telegramUpdate.handleCallback(context, TELEGRAM_CALLBACKS.refresh);

    expect(answerCbQueryMock).toHaveBeenCalledWith('Đang làm mới Home...');
    expect(editMessageTextMock).toHaveBeenCalled();
  });
});

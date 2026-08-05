import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { configuration } from 'src/config/configuration';
import { validateEnvironment } from 'src/config/env.schema';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.APP_NAME = 'TeleOps Unit';
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
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          validate: validateEnvironment,
          load: [configuration],
        }),
      ],
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns the app health payload', () => {
    const healthStatus = controller.getHealth();

    expect(healthStatus.status).toBe('ok');
    expect(healthStatus.service).toBe('TeleOps Unit');
    expect(healthStatus.environment).toBe('test');
    expect(typeof healthStatus.timestamp).toBe('string');
  });
});

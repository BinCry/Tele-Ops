import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

type HealthResponse = {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
};

function parseHealthResponse(value: unknown): HealthResponse {
  if (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'service' in value &&
    'environment' in value &&
    'timestamp' in value
  ) {
    return value as HealthResponse;
  }

  throw new Error('Invalid health response payload');
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
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

    const { AppModule } = await import('./../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response: request.Response) => {
        const body = parseHealthResponse(response.body as unknown);

        expect(body.status).toBe('ok');
        expect(body.service).toBe('TeleOps Test');
        expect(body.environment).toBe('test');
        expect(typeof body.timestamp).toBe('string');
      });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});

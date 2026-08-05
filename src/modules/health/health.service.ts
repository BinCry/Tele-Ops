import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type HealthStatus = {
  status: 'ok';
  service: string;
  environment: string;
  timestamp: string;
};

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getStatus(): HealthStatus {
    return {
      status: 'ok',
      service: this.configService.get<string>('app.name', 'TeleOps'),
      environment: this.configService.get<string>(
        'app.environment',
        'development',
      ),
      timestamp: new Date().toISOString(),
    };
  }
}

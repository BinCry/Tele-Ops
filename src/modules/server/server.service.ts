import { Injectable } from '@nestjs/common';
import {
  SystemMetricsGateway,
  SystemMetricsSnapshot,
} from './system-metrics.gateway';

@Injectable()
export class ServerService {
  constructor(private readonly systemMetricsGateway: SystemMetricsGateway) {}

  async getServerSnapshot(): Promise<SystemMetricsSnapshot> {
    return this.systemMetricsGateway.collectSnapshot();
  }
}

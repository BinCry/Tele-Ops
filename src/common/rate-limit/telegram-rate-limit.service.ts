import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

@Injectable()
export class TelegramRateLimitService {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly configService: ConfigService) {}

  consume(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - 60_000;
    const limit = this.configService.get<number>(
      'security.actionRateLimitPerMinute',
      20,
    );
    const timestamps = (this.buckets.get(key) ?? []).filter(
      (timestamp) => timestamp >= windowStart,
    );

    if (timestamps.length >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((timestamps[0]! + 60_000 - now) / 1_000),
      );

      this.buckets.set(key, timestamps);

      return {
        allowed: false,
        retryAfterSeconds,
      };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);

    return {
      allowed: true,
    };
  }
}

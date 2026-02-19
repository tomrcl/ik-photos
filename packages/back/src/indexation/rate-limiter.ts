import { Injectable } from '@nestjs/common';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

@Injectable()
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly maxTokens = 60;
  private readonly refillRate = 1; // tokens per second

  async acquire(accountId: string): Promise<void> {
    const now = Date.now();
    let bucket = this.buckets.get(accountId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(accountId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitMs = ((1 - bucket.tokens) / this.refillRate) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    bucket.tokens = 0;
    bucket.lastRefill = Date.now();
  }
}

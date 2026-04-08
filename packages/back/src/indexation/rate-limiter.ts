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
  private readonly maxBuckets = 1000;
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60_000; // cleanup every minute

  async acquire(accountId: string): Promise<void> {
    const now = Date.now();

    // Periodic cleanup of stale buckets
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup(now);
    }

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

  private cleanup(now: number): void {
    this.lastCleanup = now;
    // Remove buckets that have been idle for over 5 minutes (tokens fully refilled)
    const staleThresholdMs = 5 * 60_000;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > staleThresholdMs) {
        this.buckets.delete(key);
      }
    }
    // Hard cap: if still too many, drop oldest
    if (this.buckets.size > this.maxBuckets) {
      const sorted = [...this.buckets.entries()].sort((a, b) => a[1].lastRefill - b[1].lastRefill);
      const toRemove = sorted.slice(0, this.buckets.size - this.maxBuckets);
      for (const [key] of toRemove) {
        this.buckets.delete(key);
      }
    }
  }
}

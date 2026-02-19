import { Module } from '@nestjs/common';
import { IndexationService } from './indexation.service';
import { IndexationScheduler } from './indexation.scheduler';
import { RateLimiter } from './rate-limiter';

@Module({
  providers: [IndexationService, IndexationScheduler, RateLimiter],
  exports: [IndexationService, RateLimiter],
})
export class IndexationModule {}

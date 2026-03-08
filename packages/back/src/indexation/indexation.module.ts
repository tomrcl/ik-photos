import { Module, forwardRef } from '@nestjs/common';
import { IndexationController } from './indexation.controller';
import { IndexationService } from './indexation.service';
import { IndexationScheduler } from './indexation.scheduler';
import { RateLimiter } from './rate-limiter';
import { DrivesModule } from '../drives/drives.module';

@Module({
  imports: [forwardRef(() => DrivesModule)],
  controllers: [IndexationController],
  providers: [IndexationService, IndexationScheduler, RateLimiter],
  exports: [IndexationService, RateLimiter],
})
export class IndexationModule {}

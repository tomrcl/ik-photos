import { Global, Module } from '@nestjs/common';
import { KdriveService } from './kdrive.service';
import { IndexationModule } from '../indexation/indexation.module';

@Global()
@Module({
  // IndexationModule exports RateLimiter, which KdriveService now injects
  // to throttle deleteFile. IndexationModule does NOT import KdriveModule
  // (KdriveModule is @Global so its exports are visible everywhere), so
  // there is no module-level cycle and no forwardRef is required.
  imports: [IndexationModule],
  providers: [KdriveService],
  exports: [KdriveService],
})
export class KdriveModule {}

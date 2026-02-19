import { Global, Module } from '@nestjs/common';
import { KdriveService } from './kdrive.service';

@Global()
@Module({
  providers: [KdriveService],
  exports: [KdriveService],
})
export class KdriveModule {}

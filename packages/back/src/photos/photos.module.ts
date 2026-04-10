import { Module, forwardRef } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { TrashController } from './trash.controller';
import { TrashScheduler } from './trash.scheduler';
import { DrivesModule } from '../drives/drives.module';
import { IndexationModule } from '../indexation/indexation.module';

@Module({
  imports: [DrivesModule, forwardRef(() => IndexationModule)],
  controllers: [PhotosController, TrashController],
  providers: [PhotosService, TrashScheduler],
  exports: [PhotosService],
})
export class PhotosModule {}

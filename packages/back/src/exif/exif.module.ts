import { Module } from '@nestjs/common';
import { ExifController } from './exif.controller';
import { ExifService } from './exif.service';
import { IndexationModule } from '../indexation/indexation.module';

@Module({
  imports: [IndexationModule],
  controllers: [ExifController],
  providers: [ExifService],
  exports: [ExifService],
})
export class ExifModule {}

import { Controller, Get, Logger } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ExifService } from './exif.service';

@Controller('exif')
export class ExifController {
  private readonly logger = new Logger(ExifController.name);
  constructor(private exif: ExifService) {}

  @Public()
  @Get('trigger')
  async trigger() {
    this.logger.log('Trigger EXIF extraction batch');
    const processed = await this.exif.processBatch();
    return {
      message: 'EXIF batch processed',
      processed,
    };
  }
}

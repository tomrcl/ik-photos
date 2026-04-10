import { Controller } from '@nestjs/common';
// import { Get, Logger } from '@nestjs/common';
// import { Public } from '../auth/public.decorator';
// import { ExifService } from './exif.service';

@Controller('exif')
export class ExifController {
  // Disabled — re-enable behind a shared-secret guard before public deployment.
  // The internal @Cron job in ExifService keeps running on a schedule and is
  // the only path that should trigger EXIF extraction in production.
  // private readonly logger = new Logger(ExifController.name);
  // constructor(private exif: ExifService) {}
  //
  // @Public()
  // @Get('trigger')
  // async trigger() {
  //   this.logger.log('Trigger EXIF extraction batch');
  //   const processed = await this.exif.processBatch();
  //   return {
  //     message: 'EXIF batch processed',
  //     processed,
  //   };
  // }
}

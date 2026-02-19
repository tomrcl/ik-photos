import { Module, forwardRef } from '@nestjs/common';
import { DrivesController } from './drives.controller';
import { DrivesService } from './drives.service';
import { IndexationModule } from '../indexation/indexation.module';

@Module({
  imports: [forwardRef(() => IndexationModule)],
  controllers: [DrivesController],
  providers: [DrivesService],
  exports: [DrivesService],
})
export class DrivesModule {}

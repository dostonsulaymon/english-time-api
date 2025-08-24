import { Module } from '@nestjs/common';
import { PaymeService } from './payme.service';
import { PaymeController } from './payme.controller';

@Module({
  controllers: [PaymeController],
  providers: [PaymeService, ],
})
export class PaymeModule {}

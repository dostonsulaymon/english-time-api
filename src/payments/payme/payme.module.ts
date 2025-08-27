import { Module } from '@nestjs/common';
import { PaymeService } from './payme.service';
import { PaymeController } from './payme.controller';
import { UserPlansModule } from '../../userplans/userplans.module';

@Module({
  imports: [UserPlansModule],
  controllers: [PaymeController],
  providers: [PaymeService],
})
export class PaymeModule {}

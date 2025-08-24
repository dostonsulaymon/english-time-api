import { Module } from '@nestjs/common';
import { UserPlansService } from './userplans.service';
import { UserPlansController } from './userplans.controller';

@Module({
  controllers: [UserPlansController],
  providers: [UserPlansService],
})
export class UserPlansModule {}

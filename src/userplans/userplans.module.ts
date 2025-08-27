import { Module } from '@nestjs/common';
import { UserPlansService } from './userplans.service';
import { UserPlansController } from './userplans.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [UserPlansController],
  providers: [UserPlansService, PrismaService],
  exports: [UserPlansService],
})
export class UserPlansModule {}
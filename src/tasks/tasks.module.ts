import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PlanExpirationTask } from './plan-expiration.task';
import { UserPlansService } from '../userplans/userplans.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PlanExpirationTask, UserPlansService, PrismaService],
})
export class TasksModule {}
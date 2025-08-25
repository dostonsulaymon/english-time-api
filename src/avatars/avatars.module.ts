// src/avatars/avatars.module.ts
import { Module } from '@nestjs/common';
import { AvatarsController } from './avatars.controller';
import { AvatarsService } from './avatars.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [AvatarsController],
  providers: [AvatarsService, PrismaService],
  exports: [AvatarsService],
})
export class AvatarsModule {}
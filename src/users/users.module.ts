import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma.service';
import { RatingsService } from '../ratings/ratings.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService, RatingsService],


})
export class UsersModule {}

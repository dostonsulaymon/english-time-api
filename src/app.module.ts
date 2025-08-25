import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { RatingsModule } from './ratings/ratings.module';
import { PaymeModule } from './payments/payme/payme.module';
import { PlansModule } from './plans/plans.module';
import { UserPlansModule } from './userplans/userplans.module';
import { AvatarsModule } from './avatars/avatars.module';

@Module({
  imports: [AuthModule, UsersModule, RatingsModule, PaymeModule, PlansModule, UserPlansModule, AvatarsModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

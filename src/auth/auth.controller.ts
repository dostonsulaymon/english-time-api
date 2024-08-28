import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Prisma } from '@prisma/client';
import { PrismaClientExceptionFilter } from 'src/prisma-client-exception/prisma-client-exception.filter';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseFilters(PrismaClientExceptionFilter)
  async login(@Body() loginDto: Prisma.UserCreateInput) {
    console.log("loginDto",loginDto);
    return this.authService.login(loginDto);
  }
}

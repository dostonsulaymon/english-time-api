import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(loginDto: Prisma.UserCreateInput) {
    const user = await this.prisma.user.findFirst({
      where: { email: loginDto.email },
    });

    if (!user) {
      return this.prisma.user.create({ data: loginDto });
    }

    return user;
  }

  deleteByEmail(email: string) {
    return this.prisma.user.deleteMany({ where: { email: email } });
  }
}

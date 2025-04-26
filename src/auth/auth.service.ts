import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(loginDto: Prisma.UserCreateInput) {
    // later change to findUnique
    const user = await this.prisma.user.findFirst({
      where: { email: loginDto.email },
    });

    if (!user) {
      return this.prisma.user.create({ data: loginDto });
    }

    return user;
  }

  async deleteByEmail(email: string) {
    // First, find the user to get their ID
    const user = await this.prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return { deleted: 0 }; // User not found
    }

    // Delete all ratings associated with the user
    await this.prisma.rating.deleteMany({
      where: { userId: user.id }
    });

    // Then delete the user
    return this.prisma.user.deleteMany({
      where: { email: email }
    });
  }}

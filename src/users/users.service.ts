import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ObjectId } from 'mongodb';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(order?: number, limit?: number) {
    const users = await this.prisma.user.findMany({
      orderBy: { coins: order ? 'asc' : 'desc' },
      take: limit,
    });

    users.map((user, index) => {
      user.rating = index + 1;
    });

    return users;
  }

  async getUser(id: string) {
    const users = await this.prisma.user.findMany({
      orderBy: { coins: 'desc' },
    });

    users.map((user, index) => {
      user.rating = index + 1;
    });

    return users.find((user) => user.id === id);
  }

  async updateUser(id: string, updateUserDto: Prisma.UserUpdateInput) {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    // if (updateUserDto.coins && (updateUserDto.coins as number) < 0) {
    //   throw new BadRequestException('Coins cannot be negative');
    // }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        coins: {
          increment: updateUserDto.coins as number,
        },
      },
    });
  }
}

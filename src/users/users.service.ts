import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ObjectId } from 'mongodb';
import { PrismaService } from 'src/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { RatingPeriod } from '../ratings/types/rating-period';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingsService: RatingsService,
  ) {}

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

  async getUserStatistics(id: string) {
    // Get the basic user information
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get all-time ranking
    const allTimeRankings = await this.ratingsService.getAllTime();
    const allTimeUserRank = allTimeRankings.find((u) => u.id === id);

    const userIndex = allTimeRankings.findIndex((u) => u.id === id);
    user.rating = userIndex !== -1 ? userIndex + 1 : null;

    // Get periodic rankings
    const dailyRankings = await this.ratingsService.getByPeriod(
      RatingPeriod.DAILY,
    );
    const weeklyRankings = await this.ratingsService.getByPeriod(
      RatingPeriod.WEEKLY,
    );
    const monthlyRankings = await this.ratingsService.getByPeriod(
      RatingPeriod.MONTHLY,
    );

    // Find user in each period ranking
    const dailyStats = dailyRankings.find((u) => u.id === id);
    const weeklyStats = weeklyRankings.find((u) => u.id === id);
    const monthlyStats = monthlyRankings.find((u) => u.id === id);


    // Set currentCoins to the daily coins value
    user.currentCoins = dailyStats?.currentCoins || 0;

    // Construct the response
    return {
      ...user,
      daily: {
        rating: dailyStats?.rating || 0,
        daily_coins: dailyStats?.currentCoins || 0,
      },
      weekly: {
        rating: weeklyStats?.rating || 0,
        weekly_coins: weeklyStats?.currentCoins || 0,
      },
      monthly: {
        rating: monthlyStats?.rating || 0,
        monthly_coins: monthlyStats?.currentCoins || 0,
      },
      allTime: {
        rating: allTimeUserRank?.rating || 0,
        total_coins: user.coins,
      },
    };
  }
}

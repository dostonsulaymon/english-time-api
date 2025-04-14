import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { RatingPeriod } from './types/rating-period';
import { NewRatingDto } from './dto/new-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByPeriod(period: RatingPeriod) {
    const { startDate, endDate } = this.calculatePeriodDates(period);

    // Get all ratings for the period
    const ratings = await this.prisma.rating.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        user: true,
      },
    });

    // Calculate total score per user during this period
    const userScores = new Map();
    ratings.forEach(rating => {
      const userId = rating.userId;
      const currentScore = userScores.get(userId) || 0;
      userScores.set(userId, currentScore + rating.score);
    });

    // Get unique users with their data
    const uniqueUsers = [...new Map(ratings.map(item => [item.userId, item.user])).values()];

    // Prepare response with period-specific scores
    const result = uniqueUsers.map(user => {
      const periodScore = userScores.get(user.id) || 0;
      return {
        ...user,
        currentCoins: periodScore, // Add current period coins
      };
    });

    // Sort by period scores
    result.sort((a, b) => b.currentCoins - a.currentCoins);

    // Assign ratings
    result.forEach((user, index) => {
      user.rating = index + 1;
    });

    return result;
  }

  async getAllTime() {
    // Get all users with their total coins (all-time)
    const users = await this.prisma.user.findMany({
      orderBy: {
        coins: 'desc',
      },
    });

    // Assign ratings based on the ordering
    users.forEach((user, index) => {
      user.rating = index + 1;
    });

    return users;
  }

  private calculatePeriodDates(period: RatingPeriod) {
    const currentDate = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    switch (period) {
      case RatingPeriod.DAILY:
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
        );
        endDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() + 1,
        );
        break;
      case RatingPeriod.WEEKLY:
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - currentDate.getDay(),
        );
        endDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - currentDate.getDay() + 7,
        );
        break;
      case RatingPeriod.MONTHLY:
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );
        endDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          1,
        );
        break;
      case RatingPeriod.YEARLY:
        startDate = new Date(
          currentDate.getFullYear(),
          0,
          1,
        );
        endDate = new Date(
          currentDate.getFullYear() + 1,
          0,
          1,
        );
        break;
      default:
        throw new BadRequestException('Invalid rating period');
    }

    return { startDate, endDate };
  }

  async saveNewRating(newRatingDto: NewRatingDto) {
    const rating = await this.prisma.rating.create({
      data: {
        score: newRatingDto.score,
        userId: newRatingDto.userId,
      },
    });

    await this.prisma.user.update({
      where: { id: newRatingDto.userId },
      data: {
        coins: { increment: newRatingDto.score },
      },
    });

    return rating;
  }
}
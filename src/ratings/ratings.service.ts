import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { RatingPeriod } from './types/rating-period';
import { NewRatingDto } from './dto/new-rating.dto';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getByPeriod(period: RatingPeriod, limit: number = 10) {
    this.logger.log(`Getting ratings for period: ${period}, limit: ${limit}`);

    const { startDate, endDate } = this.calculatePeriodDates(period);
    this.logger.debug(`Period dates - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`);

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

    this.logger.debug(`Found ${ratings.length} ratings in the period`);

    // Calculate total score per user during this period
    const userScores = new Map();
    ratings.forEach(rating => {
      const userId = rating.userId;
      const currentScore = userScores.get(userId) || 0;
      userScores.set(userId, currentScore + rating.score);
      this.logger.debug(`User ${userId} period score: ${currentScore + rating.score}`);
    });

    // Get unique users with their data
    const uniqueUsers = [...new Map(ratings.map(item => [item.userId, item.user])).values()];
    this.logger.debug(`Found ${uniqueUsers.length} unique users in the period`);

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
      this.logger.debug(`User ${user.id} ranked #${user.rating} with ${user.currentCoins} coins`);
    });

    const finalResult = result.slice(0, limit);
    this.logger.log(`Returning ${finalResult.length} users for period ${period}`);

    return finalResult;
  }

  async getAllTime(limit: number = 10) {
    this.logger.log(`Getting all-time ratings, limit: ${limit}`);

    // Get all users with their total coins (all-time)
    const users = await this.prisma.user.findMany({
      orderBy: {
        coins: 'desc',
      },
      take: limit,
    });

    // Assign ratings based on the ordering
    users.forEach((user, index) => {
      user.rating = index + 1;
      this.logger.debug(`User ${user.id} all-time rank: #${user.rating} with ${user.coins} coins`);
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
        // Fix: Properly calculate the start of the week (Sunday)
        const dayOfWeek = currentDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - dayOfWeek,
        );
        endDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate() - dayOfWeek + 7,
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
        this.logger.error(`Invalid rating period: ${period}`);
        throw new BadRequestException('Invalid rating period');
    }

    this.logger.debug(`Period ${period} calculated - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`);
    return { startDate, endDate };
  }

  async saveNewRating(newRatingDto: NewRatingDto) {
    this.logger.log(`Saving new rating - userId: ${newRatingDto.userId}, score: ${newRatingDto.score}`);

    try {
      // First, create the rating record
      const rating = await this.prisma.rating.create({
        data: {
          score: newRatingDto.score,
          userId: newRatingDto.userId,
        },
      });
      this.logger.debug(`Created rating record with ID: ${rating.id}`);

      // Then, update the user's total coins
      const updatedUser = await this.prisma.user.update({
        where: { id: newRatingDto.userId },
        data: {
          coins: { increment: newRatingDto.score },
        },
      });
      this.logger.debug(`Updated user ${updatedUser.id} total coins to: ${updatedUser.coins}`);

      return rating;
    } catch (error) {
      this.logger.error(`Error saving rating: ${error.message}`, error.stack);
      throw error;
    }
  }
}
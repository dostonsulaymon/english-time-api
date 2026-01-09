import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { RatingPeriod } from './types/rating-period';
import { NewRatingDto } from './dto/new-rating.dto';
import { startOfDay, addDays, startOfWeek } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);
  private readonly TIMEZONE = 'Asia/Tashkent'; // UTC+5

  constructor(private readonly prisma: PrismaService) {}

  async cleanupOrphanedRatings() {
    this.logger.log('Starting cleanup of orphaned ratings');

    try {
      // Find all valid user IDs
      const validUsers = await this.prisma.user.findMany({
        select: { id: true },
      });

      const validUserIds = validUsers.map((user) => user.id);

      // Delete ratings that reference non-existent users
      const result = await this.prisma.rating.deleteMany({
        where: {
          userId: {
            notIn: validUserIds,
          },
        },
      });

      this.logger.log(
        `Cleanup complete: Deleted ${result.count} orphaned ratings`,
      );
      return result.count;
    } catch (error) {
      this.logger.error(
        `Error during orphaned ratings cleanup: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getByPeriod(period: RatingPeriod, limit: number = 10) {
    this.logger.log(`Getting ratings for period: ${period}, limit: ${limit}`);

    const { startDate, endDate } = this.calculatePeriodDates(period);
    this.logger.debug(
      `Period dates - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`,
    );

    // Use database aggregation to calculate scores efficiently
    const userScores = await this.prisma.rating.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        score: true,
      },
      orderBy: {
        _sum: {
          score: 'desc',
        },
      },
      take: limit,
    });

    this.logger.debug(
      `Found ${userScores.length} users with scores in the period`,
    );

    // Get user details for the top users only
    const userIds = userScores.map((item) => item.userId);

    if (userIds.length === 0) {
      this.logger.log('No ratings found for this period');
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });

    // Create a map for quick user lookup
    const userMap = new Map(users.map((user) => [user.id, user]));

    // Combine user data with their period scores
    const result = userScores
      .map((scoreData, index) => {
        const user = userMap.get(scoreData.userId);
        if (!user) return null; // Skip if user was deleted

        return {
          ...user,
          currentCoins: scoreData._sum.score || 0,
          rating: index + 1,
        };
      })
      .filter((item) => item !== null); // Remove null entries

    this.logger.log(`Returning ${result.length} users for period ${period}`);

    return result;
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
    });

    return users;
  }

  private calculatePeriodDates(period: RatingPeriod) {
    // Get current time in UTC
    const nowUtc = new Date();

    // Convert to Tashkent timezone for local calculations
    const nowTashkent = toZonedTime(nowUtc, this.TIMEZONE);

    let startDateTashkent: Date;
    let endDateTashkent: Date;

    switch (period) {
      case RatingPeriod.DAILY:
        // Calculate start of current day in Tashkent timezone
        startDateTashkent = startOfDay(nowTashkent);

        // End date is start of next day in Tashkent timezone
        endDateTashkent = addDays(startDateTashkent, 1);
        break;

      case RatingPeriod.WEEKLY:
        // Calculate start of current week (Monday) in Tashkent timezone
        // weekStartsOn: 1 means Monday is the first day of week
        startDateTashkent = startOfWeek(nowTashkent, { weekStartsOn: 1 }); // 1 = Monday

        // End date is start of next week (next Monday) in Tashkent timezone
        endDateTashkent = addDays(startDateTashkent, 7);
        break;

      default:
        this.logger.error(`Invalid rating period: ${period}`);
        throw new BadRequestException('Invalid rating period');
    }

    // Convert Tashkent local times to UTC for database queries
    // This is the critical fix - properly convert local times to UTC
    const startDate = fromZonedTime(startDateTashkent, this.TIMEZONE);
    const endDate = fromZonedTime(endDateTashkent, this.TIMEZONE);

    this.logger.debug(
      `Period ${period} in Tashkent time - start: ${startDateTashkent.toISOString()}, end: ${endDateTashkent.toISOString()}`,
    );
    this.logger.debug(
      `Period ${period} in UTC for database - start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`,
    );

    return { startDate, endDate };
  }

  async saveNewRating(newRatingDto: NewRatingDto) {
    return this.prisma.$transaction(async (tx) => {
      // Check if user exists
      const user = await tx.user.findUnique({
        where: { id: newRatingDto.userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Create rating
      const rating = await tx.rating.create({
        data: {
          score: newRatingDto.score,
          userId: newRatingDto.userId,
        },
      });

      // Update user
      await tx.user.update({
        where: { id: newRatingDto.userId },
        data: {
          coins: { increment: newRatingDto.score },
        },
      });

      return rating;
    });
  }

  // Helper method to get current time info for debugging
  async getCurrentTimeInfo() {
    const nowUtc = new Date();
    const nowTashkent = toZonedTime(nowUtc, this.TIMEZONE);

    const startOfDayTashkent = startOfDay(nowTashkent);
    const startOfWeekTashkent = startOfWeek(nowTashkent, { weekStartsOn: 1 }); // 1 = Monday

    const startOfDayUtc = fromZonedTime(startOfDayTashkent, this.TIMEZONE);
    const startOfWeekUtc = fromZonedTime(startOfWeekTashkent, this.TIMEZONE);

    return {
      currentTime: {
        utc: nowUtc.toISOString(),
        tashkent: nowTashkent.toISOString(),
      },
      dailyPeriod: {
        startTashkent: startOfDayTashkent.toISOString(),
        startUtc: startOfDayUtc.toISOString(),
      },
      weeklyPeriod: {
        startTashkent: startOfWeekTashkent.toISOString(),
        startUtc: startOfWeekUtc.toISOString(),
      },
    };
  }
}



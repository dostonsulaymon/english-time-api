import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ObjectId } from 'mongodb';
import { PrismaService } from 'src/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { RatingPeriod } from '../ratings/types/rating-period';
import { PremiumUpgradeResponse } from './dto/premium-upgrade.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly baseUrl = 'http://english-time.iwords.uz';

  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingsService: RatingsService,
  ) {}

  async upgradeToPremium(
    userId: string,
    avatarId: string,
  ): Promise<PremiumUpgradeResponse> {
    this.logger.log(
      `Upgrading user ${userId} to premium with avatar ${avatarId}`,
    );

    // Start a transaction to ensure data consistency
    return this.prisma.$transaction(async (prisma) => {
      // Get user with current data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          premiumAvatar: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get avatar details
      const avatar = await prisma.avatar.findUnique({
        where: { id: avatarId },
      });

      if (!avatar) {
        throw new NotFoundException('Avatar not found');
      }

      // Check if user has enough coins
      if (user.coins < avatar.price) {
        throw new BadRequestException(
          `Insufficient coins. Required: ${avatar.price}, Available: ${user.coins}`,
        );
      }

      // Calculate new coin balance
      const newCoinBalance = user.coins - avatar.price;

      // Update user to premium status
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          coins: newCoinBalance,
          premiumAvatarId: avatarId,
        },
        include: {
          premiumAvatar: true,
        },
      });

      this.logger.log(
        `User ${userId} upgraded to premium successfully. Coins: ${user.coins} -> ${newCoinBalance}`,
      );

      return {
        success: true,
        message: 'Successfully upgraded to premium!',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          status: updatedUser.status,
          coins: updatedUser.coins,
          premiumAvatar: {
            id: updatedUser.premiumAvatar.id,
            name: updatedUser.premiumAvatar.name,
            url: `${this.baseUrl}/avatars/${updatedUser.premiumAvatar.id}`,
            price: updatedUser.premiumAvatar.price,
          },
        },
      };
    });
  }

  async getUsers(order?: number, limit?: number) {
    this.logger.log(
      `Getting users with order: ${order ? 'asc' : 'desc'}, limit: ${limit}`,
    );

    const users = await this.prisma.user.findMany({
      orderBy: { coins: order ? 'asc' : 'desc' },
      take: limit,
      include: {
        userPlans: {
          include: {
            plan: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        premiumAvatar: true,  
      },
    });

    users.forEach((user, index) => {
      user.rating = index + 1;
    });

    return users;
  }

  async getUser(id: string) {
    this.logger.log(`Getting user by ID: ${id}`);

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userPlans: {
          include: {
            plan: true, 
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        premiumAvatar: true,  
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Successfully retrieved user: ${id}`);
    return user;
  }


  async updateUser(id: string, updateUserDto: Prisma.UserUpdateInput) {
    this.logger.log(
      `Updating user ID: ${id} with data: ${JSON.stringify(updateUserDto)}`,
    );

    if (!ObjectId.isValid(id)) {
      //this.logger.warn(`Invalid user ID format: ${id}`);
      throw new BadRequestException('Invalid user id');
    }

    try {
      // Check if we're updating coins
      if (updateUserDto.coins !== undefined) {
        const coinChange = updateUserDto.coins as number;
        //this.logger.debug(`Updating coins by ${coinChange}`);

        // If coins are being reduced, make sure user has enough
        if (coinChange < 0) {
          const user = await this.prisma.user.findUnique({ where: { id } });
          if (!user) {
            throw new BadRequestException('User not found');
          }

          if (user.coins + coinChange < 0) {
            //this.logger.warn(`Cannot reduce coins below zero. User ${id} has ${user.coins} coins, attempted change: ${coinChange}`);
            throw new BadRequestException('Coins cannot be negative');
          }
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateUserDto,
          coins:
            updateUserDto.coins !== undefined
              ? { increment: updateUserDto.coins as number }
              : undefined,
        },
      });

      //this.logger.debug(`User updated successfully: ${JSON.stringify(updatedUser)}`);
      return updatedUser;
    } catch (error) {
      ////this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserStatistics(id: string) {
    this.logger.log(`Getting statistics for user ID: ${id}`);

    if (!ObjectId.isValid(id)) {
      //this.logger.warn(`Invalid user ID format: ${id}`);
      throw new BadRequestException('Invalid user id');
    }

    try {
      // Get the basic user information
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        //this.logger.warn(`User not found with ID: ${id}`);
        throw new BadRequestException('User not found');
      }

      //this.logger.debug(`Found user: ${user.username} (${user.email})`);

      // Get all-time ranking (fully populated with all users)
      const allUsers = await this.prisma.user.findMany({
        orderBy: { coins: 'desc' },
      });

      // Find user's position in all-time ranking
      const userIndex = allUsers.findIndex((u) => u.id === id);
      const allTimeRank = userIndex !== -1 ? userIndex + 1 : null;
      //this.logger.debug(`User ${id} all-time rank: ${allTimeRank}`);

      // Get period-specific data
      //this.logger.debug('Getting daily rating data');
      const dailyRankings = await this.ratingsService.getByPeriod(
        RatingPeriod.DAILY,
        allUsers.length, // Get all users to ensure we find our target user
      );

      //this.logger.debug('Getting weekly rating data');
      const weeklyRankings = await this.ratingsService.getByPeriod(
        RatingPeriod.WEEKLY,
        allUsers.length,
      );

      // Find user in each period ranking
      const dailyStats = dailyRankings.find((u) => u.id === id);
      const weeklyStats = weeklyRankings.find((u) => u.id === id);

      //this.logger.debug(`Daily stats found: ${!!dailyStats}, Weekly stats found: ${!!weeklyStats}, Monthly stats found: ${!!monthlyStats}`);

      // Calculate period ranks properly
      // If the user isn't in the period rankings, they have no activity in that period
      const dailyRank = dailyStats?.rating || 0;
      const weeklyRank = weeklyStats?.rating || 0;

      // Construct the response
      const result = {
        ...user,
        daily: {
          rating: dailyRank,
          daily_coins: dailyStats?.currentCoins || 0,
        },
        weekly: {
          rating: weeklyRank,
          weekly_coins: weeklyStats?.currentCoins || 0,
        },
        allTime: {
          rating: allTimeRank || 0,
          total_coins: user.coins,
        },
      };

      //this.logger.debug(`Returning user statistics: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      ////this.logger.error(`Error getting user statistics: ${error.message}`, error.stack);
      throw error;
    }
  }
}

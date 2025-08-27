import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma, UserPlan, UserPlanStatus } from '@prisma/client';

export interface CreateUserPlanDto {
  userId: string;
  planId: string;
}

export interface UpdateUserPlanDto {
  startDate?: Date;
  endDate?: Date;
  status?: UserPlanStatus;
}

@Injectable()
export class UserPlansService {
  private readonly logger = new Logger(UserPlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Create a new user plan
  async create(createUserPlanDto: CreateUserPlanDto): Promise<UserPlan> {
    this.logger.log(`Creating user plan - userId: ${createUserPlanDto.userId}, planId: ${createUserPlanDto.planId}`);

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createUserPlanDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createUserPlanDto.userId} not found`);
    }

    // Validate plan exists
    const plan = await this.prisma.plan.findUnique({
      where: { id: createUserPlanDto.planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${createUserPlanDto.planId} not found`);
    }

    // Check if user already has an active plan
    const existingActivePlan = await this.findActiveUserPlan(createUserPlanDto.userId);
    if (existingActivePlan) {
      throw new BadRequestException('User already has an active plan');
    }

    // Calculate end date based on plan duration (assuming duration is in days)
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

    const userPlan = await this.prisma.userPlan.create({
      data: {
        userId: createUserPlanDto.userId,
        planId: createUserPlanDto.planId,
        startDate,
        endDate,
        status: UserPlanStatus.ACTIVE,
      },
      include: {
        user: true,
        plan: true,
      },
    });

    this.logger.log(`User plan created successfully - ID: ${userPlan.id}`);
    return userPlan;
  }

  // Find all user plans with optional filtering
  async findAll(
    skip?: number,
    take?: number,
    where?: Prisma.UserPlanWhereInput,
  ): Promise<UserPlan[]> {
    return this.prisma.userPlan.findMany({
      skip,
      take,
      where,
      include: {
        user: true,
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Find user plan by ID
  async findOne(id: string): Promise<UserPlan> {
    const userPlan = await this.prisma.userPlan.findUnique({
      where: { id },
      include: {
        user: true,
        plan: true,
      },
    });

    if (!userPlan) {
      throw new NotFoundException(`User plan with ID ${id} not found`);
    }

    return userPlan;
  }

  // Find user plans by user ID (all plans - active and inactive)
  async findByUserId(userId: string): Promise<UserPlan[]> {
    return this.prisma.userPlan.findMany({
      where: { userId },
      include: {
        user: true,
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Find active user plan for a specific user
  async findActiveUserPlan(userId: string): Promise<UserPlan | null> {
    const now = new Date();

    return this.prisma.userPlan.findFirst({
      where: {
        userId,
        status: UserPlanStatus.ACTIVE,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        user: true,
        plan: true,
      },
    });
  }

  // Update user plan
  async update(id: string, updateUserPlanDto: UpdateUserPlanDto): Promise<UserPlan> {
    // Check if user plan exists
    await this.findOne(id);

    const updatedUserPlan = await this.prisma.userPlan.update({
      where: { id },
      data: updateUserPlanDto,
      include: {
        user: true,
        plan: true,
      },
    });

    this.logger.log(`User plan updated successfully - ID: ${id}`);
    return updatedUserPlan;
  }

  // Delete user plan (soft delete by marking as canceled)
  async remove(id: string): Promise<UserPlan> {
    // Check if user plan exists
    await this.findOne(id);

    const deletedUserPlan = await this.prisma.userPlan.update({
      where: { id },
      data: {
        status: UserPlanStatus.CANCELED,
      },
      include: {
        user: true,
        plan: true,
      },
    });

    this.logger.log(`User plan marked as canceled successfully - ID: ${id}`);
    return deletedUserPlan;
  }

  // Check if user plan is active
  async isUserPlanActive(id: string): Promise<boolean> {
    const userPlan = await this.findOne(id);
    const now = new Date();

    return (
      userPlan.status === UserPlanStatus.ACTIVE &&
      userPlan.startDate <= now &&
      userPlan.endDate >= now
    );
  }

  // Get expired plans that are still marked as active (for cleanup)
  async findExpiredActivePlans(): Promise<UserPlan[]> {
    const now = new Date();

    return this.prisma.userPlan.findMany({
      where: {
        status: UserPlanStatus.ACTIVE,
        endDate: { lt: now },
      },
      include: {
        user: true,
        plan: true,
      },
    });
  }

  // Mark expired active plans as expired
  async markExpiredPlansAsExpired(): Promise<void> {
    const now = new Date();

    const result = await this.prisma.userPlan.updateMany({
      where: {
        status: UserPlanStatus.ACTIVE,
        endDate: { lt: now },
      },
      data: {
        status: UserPlanStatus.EXPIRED,
      },
    });

    this.logger.log(`Marked ${result.count} expired plans as EXPIRED`);
  }

  // Get all expired plans (regardless of status)
  async findExpiredPlans(): Promise<UserPlan[]> {
    const now = new Date();

    return this.prisma.userPlan.findMany({
      where: {
        endDate: { lt: now },
      },
      include: {
        user: true,
        plan: true,
      },
    });
  }

  // UPDATED METHOD FOR PAYMENT SUCCESS PROCESSING
  async handleSuccessfulPayment(userId: string, planId: string): Promise<void> {
    this.logger.log(`Processing successful payment for user ${userId} and plan ${planId}`);

    try {
      await this.prisma.$transaction(async (prisma) => {
        const existingActivePlan = await prisma.userPlan.findFirst({
          where: {
            userId,
            status: UserPlanStatus.ACTIVE,
            endDate: { gte: new Date() },
          },
        });

        if (existingActivePlan) {
          throw new BadRequestException(
            `User ${userId} already has an active plan ${existingActivePlan.id}. Cannot purchase a new plan until current plan expires.`
          );
        }

        // 3. Mark any expired but still ACTIVE status plans as EXPIRED
        await prisma.userPlan.updateMany({
          where: {
            userId,
            status: UserPlanStatus.ACTIVE,
            endDate: { lt: new Date() },
          },
          data: {
            status: UserPlanStatus.EXPIRED,
          },
        });

        // 4. Get plan details to calculate end date
        const plan = await prisma.plan.findUnique({
          where: { id: planId },
        });

        if (!plan) {
          throw new Error(`Plan with ID ${planId} not found`);
        }

        // 5. Calculate end date (duration in days)
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

        // 6. Create new user plan
        const userPlan = await prisma.userPlan.create({
          data: {
            userId,
            planId,
            startDate,
            endDate,
            status: UserPlanStatus.ACTIVE,
          },
        });

        this.logger.log(`Created user plan ${userPlan.id} for user ${userId}`);

        // 7. Update user status to premium (true)
        await prisma.user.update({
          where: { id: userId },
          data: { status: true },
        });

        this.logger.log(`Updated user ${userId} status to premium`);
      });

      this.logger.log(`Successfully processed payment for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error processing successful payment for user ${userId}:`, error);
      throw error;
    }
  }

  // Utility method to get user's plan history
  async getUserPlanHistory(userId: string): Promise<UserPlan[]> {
    return this.prisma.userPlan.findMany({
      where: { userId },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Method to cancel an active plan (different from remove which soft deletes)
  async cancelActivePlan(userId: string): Promise<UserPlan | null> {
    const activePlan = await this.findActiveUserPlan(userId);

    if (!activePlan) {
      return null;
    }

    const canceledPlan = await this.prisma.userPlan.update({
      where: { id: activePlan.id },
      data: {
        status: UserPlanStatus.CANCELED,
      },
      include: {
        user: true,
        plan: true,
      },
    });

    // Also update user status to non-premium
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: false },
    });

    this.logger.log(`Canceled active plan ${activePlan.id} for user ${userId}`);
    return canceledPlan;
  }
}
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma, UserPlan } from '@prisma/client';

export interface CreateUserPlanDto {
  userId: string;
  planId: string;
}

export interface UpdateUserPlanDto {
  startDate?: Date;
  endDate?: Date;
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
    const existingUserPlan = await this.findActiveUserPlan(createUserPlanDto.userId);
    if (existingUserPlan) {
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

  // Find user plans by user ID
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

  // Delete user plan
  async remove(id: string): Promise<UserPlan> {
    // Check if user plan exists
    await this.findOne(id);

    const deletedUserPlan = await this.prisma.userPlan.delete({
      where: { id },
      include: {
        user: true,
        plan: true,
      },
    });

    this.logger.log(`User plan deleted successfully - ID: ${id}`);
    return deletedUserPlan;
  }

  // Check if user plan is active
  async isUserPlanActive(id: string): Promise<boolean> {
    const userPlan = await this.findOne(id);
    const now = new Date();

    return userPlan.startDate <= now && userPlan.endDate >= now;
  }

  // Get expired user plans
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

  // METHOD FOR PAYMENT SUCCESS PROCESSING
  async handleSuccessfulPayment(userId: string, planId: string): Promise<void> {
    this.logger.log(`Processing successful payment for user ${userId} and plan ${planId}`);

    try {
      await this.prisma.$transaction(async (prisma) => {
        // 1. Check if user already has an active plan
        const now = new Date();
        const existingActivePlan = await prisma.userPlan.findFirst({
          where: {
            userId,
            startDate: { lte: now },
            endDate: { gte: now },
          },
        });

        // 2. If user has an active plan, we might want to extend it or replace it
        // For now, let's replace it (delete the old one)
        if (existingActivePlan) {
          this.logger.warn(`User ${userId} already has an active plan ${existingActivePlan.id}, will be replaced`);
          await prisma.userPlan.delete({
            where: { id: existingActivePlan.id },
          });
        }

        // 3. Get plan details to calculate end date
        const plan = await prisma.plan.findUnique({
          where: { id: planId },
        });

        if (!plan) {
          throw new Error(`Plan with ID ${planId} not found`);
        }

        // 4. Calculate end date (duration in days)
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));

        // 5. Create new user plan
        const userPlan = await prisma.userPlan.create({
          data: {
            userId,
            planId,
            startDate,
            endDate,
          },
        });

        this.logger.log(`Created user plan ${userPlan.id} for user ${userId}`);

        // 6. Update user status to premium (true)
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
}
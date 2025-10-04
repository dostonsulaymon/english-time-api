import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserPlansService } from '../userplans/userplans.service';
import { PrismaService } from '../prisma.service';
import { UserPlanStatus } from '@prisma/client';

@Injectable()
export class PlanExpirationTask {
  private readonly logger = new Logger(PlanExpirationTask.name);

  constructor(
    private readonly userPlansService: UserPlansService,
    private readonly prisma: PrismaService,
  ) {}

  // Run every hour at minute 0
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredPlans() {
    this.logger.log('Starting expired plans cleanup job...');

    try {
      const now = new Date();

      // Find all expired plans that are still marked as ACTIVE
      const expiredPlans = await this.prisma.userPlan.findMany({
        where: {
          status: UserPlanStatus.ACTIVE,
          endDate: { lt: now },
        },
        include: {
          user: true,
        },
      });

      if (expiredPlans.length === 0) {
        this.logger.log('No expired plans found');
        return;
      }

      this.logger.log(`Found ${expiredPlans.length} expired plans to process`);

      // Process each expired plan
      for (const plan of expiredPlans) {
        try {
          await this.prisma.$transaction(async (prisma) => {
            // Mark the plan as expired
            await prisma.userPlan.update({
              where: { id: plan.id },
              data: { status: UserPlanStatus.EXPIRED },
            });

            // Check if user has any other active plans
            const otherActivePlans = await prisma.userPlan.findFirst({
              where: {
                userId: plan.userId,
                status: UserPlanStatus.ACTIVE,
                endDate: { gte: now },
                id: { not: plan.id }, // Exclude the current plan
              },
            });

            // If no other active plans, set user status to non-premium
            if (!otherActivePlans) {
              await prisma.user.update({
                where: { id: plan.userId },
                data: { status: false },
              });

              this.logger.log(
                `User ${plan.userId} set to non-premium (no active plans remaining)`,
              );
            }

            this.logger.log(
              `Plan ${plan.id} for user ${plan.userId} marked as EXPIRED`,
            );
          });
        } catch (error) {
          this.logger.error(
            `Error processing expired plan ${plan.id}:`,
            error.message,
          );
          // Continue with other plans even if one fails
        }
      }

      this.logger.log('Expired plans cleanup job completed successfully');
    } catch (error) {
      this.logger.error('Error in expired plans cleanup job:', error.message);
    }
  }

  // Optional: Run at midnight every day for a comprehensive cleanup
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyCleanup() {
    this.logger.log('Starting daily comprehensive cleanup...');
    await this.handleExpiredPlans();
  }
}
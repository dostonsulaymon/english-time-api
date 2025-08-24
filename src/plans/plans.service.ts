import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllPlans() {
    return this.prisma.plan.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPlanById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return plan;
  }

  async updatePlan(id: string, updatePlanDto: UpdatePlanDto) {
    const existingPlan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return this.prisma.plan.update({
      where: { id },
      data: updatePlanDto,
    });
  }
}
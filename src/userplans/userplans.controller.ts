import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { UserPlansService, CreateUserPlanDto, UpdateUserPlanDto } from './userplans.service';
import { ObjectId } from 'mongodb';

@Controller('user-plans')
export class UserPlansController {
  private readonly logger = new Logger(UserPlansController.name);

  constructor(private readonly userPlansService: UserPlansService) {}

  @Post()
  async create(@Body() createUserPlanDto: CreateUserPlanDto) {
    this.logger.log(`Creating user plan - userId: ${createUserPlanDto.userId}, planId: ${createUserPlanDto.planId}`);

    // Validate ObjectId format
    if (!ObjectId.isValid(createUserPlanDto.userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    if (!ObjectId.isValid(createUserPlanDto.planId)) {
      throw new BadRequestException('Invalid plan ID format');
    }

    return this.userPlansService.create(createUserPlanDto);
  }

  @Get()
  async findAll(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('userId') userId?: string,
  ) {
    this.logger.log(`Getting user plans - skip: ${skip}, take: ${take}, userId: ${userId}`);

    let where = {};
    if (userId) {
      if (!ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }
      where = { userId };
    }

    return this.userPlansService.findAll(skip, take, where);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`Getting user plan by ID: ${id}`);

    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user plan ID format');
    }

    return this.userPlansService.findOne(id);
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string) {
    this.logger.log(`Getting user plans for user: ${userId}`);

    if (!ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    return this.userPlansService.findByUserId(userId);
  }

  @Get('user/:userId/active')
  async findActiveUserPlan(@Param('userId') userId: string) {
    this.logger.log(`Getting active user plan for user: ${userId}`);

    if (!ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    return this.userPlansService.findActiveUserPlan(userId);
  }

  @Get('user/:userId/status')
  async checkUserPlanStatus(@Param('userId') userId: string) {
    this.logger.log(`Checking user plan status for user: ${userId}`);

    if (!ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const activePlan = await this.userPlansService.findActiveUserPlan(userId);

    return {
      hasActivePlan: !!activePlan,
      activePlan: activePlan || null,
    };
  }

  @Get('expired/list')
  async findExpiredPlans() {
    this.logger.log('Getting expired user plans');
    return this.userPlansService.findExpiredPlans();
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserPlanDto: UpdateUserPlanDto
  ) {
    this.logger.log(`Updating user plan: ${id}`);

    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user plan ID format');
    }

    return this.userPlansService.update(id, updateUserPlanDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`Deleting user plan: ${id}`);

    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user plan ID format');
    }

    return this.userPlansService.remove(id);
  }
}
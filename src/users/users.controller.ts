import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseFilters,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import { PrismaClientExceptionFilter } from 'src/prisma-client-exception/prisma-client-exception.filter';
import { ObjectId } from 'mongodb';

@Controller('users')
@UseFilters(PrismaClientExceptionFilter)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get('all')
  async getUsers(
    @Query('order', new ParseIntPipe({ optional: true })) order?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    //this.logger.log(`GET /users/all - order: ${order}, limit: ${limit}`);

    try {
      const users = await this.usersService.getUsers(order, limit);
      this.logger.log(`Successfully retrieved ${users.length} users`);
      return users;
    } catch (error) {
      //this.logger.error(`Error getting users: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('/:id')
  async getUser(@Param('id') id: string) {
    //this.logger.log(`GET /users/${id}`);

    if (!ObjectId.isValid(id)) {
      //this.logger.warn(`Invalid user ID format: ${id}`);
      throw new BadRequestException('Invalid user id');
    }

    try {
      const user = await this.usersService.getUser(id);

      if (!user) {
        this.logger.warn(`User not found with ID: ${id}`);
        throw new BadRequestException('User not found');
      }

      //this.logger.log(`Successfully retrieved user: ${user.id}`);
      return user;
    } catch (error) {
      //this.logger.error(`Error getting user: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('/:id/statistics')
  async getUserStatistics(@Param('id') id: string) {
    //this.logger.log(`GET /users/${id}/statistics`);

    if (!ObjectId.isValid(id)) {
      //this.logger.warn(`Invalid user ID format: ${id}`);
      throw new BadRequestException('Invalid user id');
    }

    try {
      const stats = await this.usersService.getUserStatistics(id);
      // //this.logger.log(`Successfully retrieved statistics for user: ${id}`);
      return stats;
    } catch (error) {
      // //this.logger.error(`Error getting user statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch('/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: Prisma.UserUpdateInput,
  ) {
    //this.logger.log(`PATCH /users/${id} - data: ${JSON.stringify(updateUserDto)}`);

    if (!ObjectId.isValid(id)) {
      //this.logger.warn(`Invalid user ID format: ${id}`);
      throw new BadRequestException('Invalid user id');
    }

    if (updateUserDto.email) {
      //this.logger.warn(`Attempted to change email: ${updateUserDto.email}`);
      throw new BadRequestException('Email cannot be changed');
    }

    try {
      const updatedUser = await this.usersService.updateUser(id, updateUserDto);
      //this.logger.log(`Successfully updated user: ${id}`);
      return updatedUser;
    } catch (error) {
      // //this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw error;
    }
  }
}
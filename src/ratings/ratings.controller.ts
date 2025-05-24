import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { RatingPeriod } from './types/rating-period';
import { NewRatingDto } from './dto/new-rating.dto';
import { ObjectId } from 'mongodb';
import { PrismaClientExceptionFilter } from 'src/prisma-client-exception/prisma-client-exception.filter';

@Controller('ratings')
@UseFilters(PrismaClientExceptionFilter)
export class RatingsController {
  private readonly logger = new Logger(RatingsController.name);

  constructor(private readonly ratingsService: RatingsService) {}

  // Debug endpoint to check timezone calculations
  @Get('debug/time-info')
  async getTimeInfo() {
    this.logger.log('GET /ratings/debug/time-info - Getting current time information');
    try {
      const result = await this.ratingsService.getCurrentTimeInfo();
      this.logger.log('Successfully retrieved time information');
      return result;
    } catch (error) {
      this.logger.error(`Error getting time information: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('cleanup')
  async cleanupOrphanedRatings() {
    this.logger.log('Manual cleanup of orphaned ratings triggered');
    return this.ratingsService.cleanupOrphanedRatings();
  }

  @Get('period')
  async getByPeriod(
    @Query('period') period: RatingPeriod,
    @Query('limit') limit: string = '10'
  ) {
    this.logger.log(`GET /ratings/period - period: ${period}, limit: ${limit}`);

    // Validate the period parameter
    if (!Object.values(RatingPeriod).includes(period)) {
      this.logger.warn(`Invalid period parameter: ${period}`);
      throw new BadRequestException(`Invalid period. Valid values are: ${Object.values(RatingPeriod).join(', ')}`);
    }

    const limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber <= 0) {
      this.logger.warn(`Invalid limit parameter: ${limit}`);
      throw new BadRequestException('Limit must be a positive number');
    }

    try {
      const result = await this.ratingsService.getByPeriod(period, limitNumber);
      this.logger.log(`Successfully retrieved ${result.length} ratings for period ${period}`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting ratings for period ${period}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('all-time')
  async getAllTime(@Query('limit') limit: string = '10') {
    this.logger.log(`GET /ratings/all-time - limit: ${limit}`);

    const limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber <= 0) {
      this.logger.warn(`Invalid limit parameter: ${limit}`);
      throw new BadRequestException('Limit must be a positive number');
    }

    try {
      const result = await this.ratingsService.getAllTime(limitNumber);
      this.logger.log(`Successfully retrieved ${result.length} all-time ratings`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting all-time ratings: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('save')
  async save(@Body() newRatingDto: NewRatingDto) {
    this.logger.log(`POST /ratings/save - body: ${JSON.stringify(newRatingDto)}`);

    if (!newRatingDto.userId || !ObjectId.isValid(newRatingDto.userId)) {
      this.logger.warn(`Invalid user id: ${newRatingDto.userId}`);
      throw new BadRequestException('Invalid user id');
    }

    if (newRatingDto.score === undefined || isNaN(newRatingDto.score) || newRatingDto.score < 0) {
      this.logger.warn(`Invalid score: ${newRatingDto.score}`);
      throw new BadRequestException('Score must be a non-negative number');
    }

    try {
      const result = await this.ratingsService.saveNewRating(newRatingDto);
      this.logger.log(`Successfully saved rating with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error saving rating: ${error.message}`, error.stack);
      throw error;
    }
  }
}

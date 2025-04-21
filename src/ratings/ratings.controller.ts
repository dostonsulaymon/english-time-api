import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { RatingPeriod } from './types/rating-period';
import { NewRatingDto } from './dto/new-rating.dto';
import { ObjectId } from 'mongodb';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('period')
  async getByPeriod(
    @Query('period') period: RatingPeriod,
    @Query('limit') limit: string = '10'
  ) {
    const limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber <= 0) {
      throw new BadRequestException('Limit must be a positive number');
    }
    return await this.ratingsService.getByPeriod(period, limitNumber);
  }

  @Get('all-time')
  async getAllTime(@Query('limit') limit: string = '10') {
    const limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber <= 0) {
      throw new BadRequestException('Limit must be a positive number');
    }
    return await this.ratingsService.getAllTime(limitNumber);
  }

  @Post('save')
  async save(@Body() newRatingDto: NewRatingDto) {
    if (!ObjectId.isValid(newRatingDto.userId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (newRatingDto.score < 0) {
      throw new BadRequestException('Score cannot be negative');
    }
    return await this.ratingsService.saveNewRating(newRatingDto);
  }
}
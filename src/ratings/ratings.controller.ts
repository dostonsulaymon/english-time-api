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
  async getByPeriod(@Query('period') period: RatingPeriod) {
    return await this.ratingsService.getByPeriod(period);
  }

  @Get('all-time')
  async getAllTime() {
    return await this.ratingsService.getAllTime();
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
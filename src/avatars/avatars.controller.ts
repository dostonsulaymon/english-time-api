// src/avatars/avatars.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  Logger,
  Render,
  UseFilters,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AvatarsService } from './avatars.service';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { PrismaClientExceptionFilter } from 'src/prisma-client-exception/prisma-client-exception.filter';
import { ObjectId } from 'mongodb';
import { SkipAuth } from '../auth/decorator';

@Controller('avatars')
@SkipAuth()
@UseFilters(PrismaClientExceptionFilter)
export class AvatarsController {
  private readonly logger = new Logger(AvatarsController.name);

  constructor(private readonly avatarsService: AvatarsService) {}

  // Admin page - renders EJS template
  @Get('admin')
  @Render('admin/avatars')
  async adminPage() {
    this.logger.log('GET /avatars/admin - Rendering admin page');
    try {
      const avatars = await this.avatarsService.getAllAvatars();
      return { avatars };
    } catch (error) {
      this.logger.error(`Error loading admin page: ${error.message}`, error.stack);
      return { avatars: [], error: 'Failed to load avatars' };
    }
  }

  // API Endpoints
  @Post('upload')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('price') price: string,
  ) {
    this.logger.log(`POST /avatars/upload - file: ${file?.originalname}, name: ${name}, price: ${price}`);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const priceNumber = price ? parseInt(price, 10) : 0;
      const result = await this.avatarsService.uploadAvatar(file, name, priceNumber);
      this.logger.log(`Avatar uploaded successfully: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error uploading avatar: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('all')
  async getAllAvatars() {
    this.logger.log('GET /avatars/all');
    try {
      const result = await this.avatarsService.getAllAvatars();
      this.logger.log(`Successfully retrieved ${result.length} avatars`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting avatars: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id/info')
  async getAvatarById(@Param('id') id: string) {
    this.logger.log(`GET /avatars/${id}/info`);

    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid avatar ID');
    }

    try {
      const result = await this.avatarsService.getAvatarById(id);
      this.logger.log(`Successfully retrieved avatar: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error getting avatar: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id')
  async serveAvatar(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(`GET /avatars/${id} - Serving avatar file`);

    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid avatar ID');
    }

    try {
      const { filePath, mimetype, filename } = await this.avatarsService.getAvatarFile(id);

      res.setHeader('Content-Type', mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.sendFile(filePath, { root: '.' });

      this.logger.log(`Successfully served avatar file: ${id}`);
    } catch (error) {
      this.logger.error(`Error serving avatar: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch(':id')
  async updateAvatar(
    @Param('id') id: string,
    @Body() updateData: UpdateAvatarDto,
  ) {
    this.logger.log(`PATCH /avatars/${id} - data: ${JSON.stringify(updateData)}`);

    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid avatar ID');
    }

    try {
      const result = await this.avatarsService.updateAvatar(id, updateData);
      this.logger.log(`Successfully updated avatar: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating avatar: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  async deleteAvatar(@Param('id') id: string) {
    this.logger.log(`DELETE /avatars/${id}`);

    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid avatar ID');
    }

    try {
      await this.avatarsService.deleteAvatar(id);
      this.logger.log(`Successfully deleted avatar: ${id}`);
      return { message: 'Avatar deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting avatar: ${error.message}`, error.stack);
      throw error;
    }
  }
}
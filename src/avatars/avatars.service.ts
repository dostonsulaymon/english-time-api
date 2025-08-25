// src/avatars/avatars.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { AvatarResponseDto } from './dto/avatar-response.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);
  private readonly uploadPath = 'uploads/avatars';
  private readonly baseUrl = 'http://english-time.iwords.uz'; // Your base URL

  constructor(private readonly prisma: PrismaService) {
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory() {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadPath}`);
    }
  }

  async uploadAvatar(file: Express.Multer.File, name: string, price: number = 0): Promise<AvatarResponseDto> {
    this.logger.log(`Uploading avatar: ${file.originalname}, price: ${price}`);

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const timestamp = Date.now();
    const filename = `avatar_${timestamp}_${Math.random().toString(36).substring(2)}${fileExtension}`;
    const filePath = path.join(this.uploadPath, filename);

    // Save file to disk
    fs.writeFileSync(filePath, file.buffer);

    // Save to database
    const avatar = await this.prisma.avatar.create({
      data: {
        name: name || file.originalname,
        filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: filePath,
        price: price,
      },
    });

    this.logger.log(`Avatar uploaded successfully with ID: ${avatar.id}`);
    return this.mapToResponseDto(avatar);
  }

  async getAllAvatars(): Promise<AvatarResponseDto[]> {
    this.logger.log('Getting all avatars');

    const avatars = await this.prisma.avatar.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return avatars.map(avatar => this.mapToResponseDto(avatar));
  }

  async getAvatarById(id: string): Promise<AvatarResponseDto> {
    this.logger.log(`Getting avatar by ID: ${id}`);

    const avatar = await this.prisma.avatar.findUnique({
      where: { id },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }

    return this.mapToResponseDto(avatar);
  }

  async updateAvatar(id: string, updateData: UpdateAvatarDto): Promise<AvatarResponseDto> {
    this.logger.log(`Updating avatar ID: ${id}`);

    const avatar = await this.prisma.avatar.findUnique({
      where: { id },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }

    const updatedAvatar = await this.prisma.avatar.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Avatar updated successfully: ${id}`);
    return this.mapToResponseDto(updatedAvatar);
  }

  async deleteAvatar(id: string): Promise<void> {
    this.logger.log(`Deleting avatar ID: ${id}`);

    const avatar = await this.prisma.avatar.findUnique({
      where: { id },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }

    // Delete file from disk
    if (fs.existsSync(avatar.path)) {
      fs.unlinkSync(avatar.path);
      this.logger.log(`Deleted file: ${avatar.path}`);
    }

    // Delete from database
    await this.prisma.avatar.delete({
      where: { id },
    });

    this.logger.log(`Avatar deleted successfully: ${id}`);
  }

  async getAvatarFile(id: string): Promise<{ filePath: string; mimetype: string; filename: string }> {
    this.logger.log(`Getting avatar file for ID: ${id}`);

    const avatar = await this.prisma.avatar.findUnique({
      where: { id },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }

    if (!fs.existsSync(avatar.path)) {
      this.logger.error(`File not found on disk: ${avatar.path}`);
      throw new NotFoundException('Avatar file not found on disk');
    }

    return {
      filePath: avatar.path,
      mimetype: avatar.mimetype,
      filename: avatar.originalName,
    };
  }

  private mapToResponseDto(avatar: any): AvatarResponseDto {
    return {
      id: avatar.id,
      name: avatar.name,
      filename: avatar.filename,
      originalName: avatar.originalName,
      mimetype: avatar.mimetype,
      size: avatar.size,
      price: avatar.price || 0,
      url: `${this.baseUrl}/avatars/${avatar.id}`, // Full clickable URL
      createdAt: avatar.createdAt,
      updatedAt: avatar.updatedAt,
    };
  }
}
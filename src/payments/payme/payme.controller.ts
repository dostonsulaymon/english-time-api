import {Body, Controller, HttpCode, HttpStatus, Post, UseGuards,} from '@nestjs/common';
import {PaymeService} from './payme.service';
import {RequestBody} from './types/incoming-request-body';
import {PaymeBasicAuthGuard} from "./auth/guards/payme.guard";
import { SkipAuth } from '../../auth/decorator';
import { GenerateLinkDto } from './dto/generate-link.dto';
import logger from '../../utils/logger';


@Controller('payme')
export class PaymeController {
  constructor(private readonly paymeService: PaymeService) {}

  @Post()
  @SkipAuth()
  @UseGuards(PaymeBasicAuthGuard)
  @HttpCode(HttpStatus.OK)
  async handleTransactionMethods(@Body() reqBody: RequestBody) {
    logger.warn(`reqBody: ${JSON.stringify(reqBody)}`);
    return await this.paymeService.handleTransactionMethods(reqBody);
  }

  @Post('/link')
  @SkipAuth()
  async generatePaymeLink(@Body() reqBody: GenerateLinkDto) {

   return await this.paymeService.generatePaymeLink(reqBody);

  }
}

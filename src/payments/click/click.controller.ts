import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ClickRequest } from './types/click-request.type';
import { ClickService } from './click.service';
import { SkipAuth } from '../../auth/decorator';
import { GenerateLinkDto } from '../payme/dto/generate-link.dto';

@Controller('click')
@SkipAuth()
export class ClickController {
  constructor(private readonly clickService: ClickService) {}
  @Post('')
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  async handleMerchantTransactions(@Body() clickReqBody: ClickRequest) {
    return await this.clickService.handleMerchantTransactions(clickReqBody);
  }

  @Post('/link')
  @SkipAuth()
  async generatePaymeLink(@Body() reqBody: GenerateLinkDto) {
    return await this.clickService.generateClickLink(reqBody);
  }
}

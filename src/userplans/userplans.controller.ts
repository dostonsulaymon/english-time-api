import { Controller } from '@nestjs/common';
import { UserPlansService } from './userplans.service';

@Controller('userplans')
export class UserPlansController {
  constructor(private readonly userplansService: UserPlansService) {}
}

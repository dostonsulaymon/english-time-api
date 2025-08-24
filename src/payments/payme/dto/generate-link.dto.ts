import { IsNotEmpty } from 'class-validator';

export class GenerateLinkDto{

  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  planId: string;
}
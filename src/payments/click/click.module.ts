import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ClickController } from "./click.controller";
import { ClickService } from "./click.service";
import { PrismaService } from '../../prisma.service';
import { UserPlansModule } from '../../userplans/userplans.module';


@Module({
    imports: [ConfigModule, UserPlansModule],
    controllers: [ClickController],
    providers: [ClickService, PrismaService],
})
export class ClickModule { }
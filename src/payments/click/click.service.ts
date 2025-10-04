import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClickRequest } from './types/click-request.type';
import { ClickAction, ClickError } from './enums';
import { generateMD5 } from 'src/utils/hashing/hasher.helper';
import { PrismaService } from '../../prisma.service';
import { UserPlansService } from '../../userplans/userplans.service';
import { GenerateLinkDto } from '../payme/dto/generate-link.dto';
import {
  ClickRedirectParams,
  getClickRedirectLink,
} from '../../shared/generators/click-redirect-link.generator';
import { ObjectId } from 'mongodb';

@Injectable()
export class ClickService {
  private readonly secretKey: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly userPlansService: UserPlansService,
  ) {
    this.secretKey = this.configService.get<string>('CLICK_SECRET');
  }

  async handleMerchantTransactions(clickReqBody: ClickRequest) {
    const actionType = +clickReqBody.action;

    clickReqBody.amount = parseFloat(clickReqBody.amount + '');

    switch (actionType) {
      case ClickAction.Prepare:
        return this.prepare(clickReqBody);
      case ClickAction.Complete:
        return this.complete(clickReqBody);
      default:
        return {
          error: ClickError.ActionNotFound,
          error_note: 'Invalid action',
        };
    }
  }

  async prepare(clickReqBody: ClickRequest) {
    const planId = clickReqBody.merchant_trans_id;
    const userId = clickReqBody.param2;
    const amount = clickReqBody.amount;
    const transId = clickReqBody.click_trans_id + ''; // ! in db transId is string
    const signString = clickReqBody.sign_string;
    const signTime = new Date(clickReqBody.sign_time).toISOString();
    const myMD5Params = {
      clickTransId: transId,
      serviceId: clickReqBody.service_id,
      secretKey: this.secretKey,
      merchantTransId: planId,
      amount: amount,
      action: clickReqBody.action,
      signTime: clickReqBody.sign_time,
    };

    const myMD5Hash = generateMD5(myMD5Params);

    if (signString !== myMD5Hash) {
      return {
        error: ClickError.SignFailed,
        error_note: 'Invalid sign_string',
      };
    }

    const isAlreadyPaid = await this.prismaService.clickTransaction.findFirst({
      where: {
        userId,
        planId,
        status: 'PAID',
      },
    });

    if (isAlreadyPaid) {
      return {
        error: ClickError.AlreadyPaid,
        error_note: 'Already paid',
      };
    }

    const isCancelled = await this.prismaService.clickTransaction.findFirst({
      where: {
        userId: userId,
        planId: planId,
        status: 'CANCELED',
      },
    });

    if (isCancelled) {
      return {
        error: ClickError.TransactionCanceled,
        error_note: 'Cancelled',
      };
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid userId',
      };
    }

    const plan = await this.prismaService.plan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!plan) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Product not found',
      };
    }

    // Use plan.price instead of plan.amount
    if (parseInt(`${amount}`) !== plan.price) {
      console.error('Invalid amount');
      return {
        error: ClickError.InvalidAmount,
        error_note: 'Invalid amount',
      };
    }

    const transaction = await this.prismaService.clickTransaction.findUnique({
      where: {
        clickTransId: transId,
      },
    });

    if (transaction && transaction.status == 'CANCELED') {
      return {
        error: ClickError.TransactionCanceled,
        error_note: 'Transaction canceled',
      };
    }

    const time = new Date().getTime();

    await this.prismaService.clickTransaction.create({
      data: {
        plan: {
          connect: {
            id: planId,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
        signTime,
        merchantTransId: planId,
        action: ClickAction.Prepare,
        clickTransId: transId,
        prepareId: '' + time,
        status: 'PENDING',
        amount: clickReqBody.amount,
        createdDate: new Date(time),
      },
    });

    return {
      click_trans_id: +transId,
      merchant_trans_id: planId,
      merchant_prepare_id: time,
      error: ClickError.Success,
      error_note: 'Success',
    };
  }

  async complete(clickReqBody: ClickRequest) {
    const planId = clickReqBody.merchant_trans_id;
    const userId = clickReqBody.param2;
    const prepareId = clickReqBody.merchant_prepare_id;
    const transId = clickReqBody.click_trans_id + ''; // ! in db transId is string
    const serviceId = clickReqBody.service_id;
    const amount = clickReqBody.amount;
    const signTime = clickReqBody.sign_time;
    const error = clickReqBody.error;
    const signString = clickReqBody.sign_string;

    const myMD5Params = {
      clickTransId: transId,
      serviceId,
      secretKey: this.secretKey,
      merchantTransId: planId,
      merchantPrepareId: prepareId,
      amount,
      action: clickReqBody.action,
      signTime,
    };

    const myMD5Hash = generateMD5(myMD5Params);

    if (signString !== myMD5Hash) {
      return {
        error: ClickError.SignFailed,
        error_note: 'Invalid sign_string',
      };
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid userId',
      };
    }

    const plan = await this.prismaService.plan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!plan) {
      return {
        error: ClickError.UserNotFound,
        error_note: 'Invalid planId',
      };
    }

    const isPrepared = await this.prismaService.clickTransaction.findFirst({
      where: {
        prepareId: '' + prepareId,
        userId: userId,
        planId: planId,
      },
    });

    if (!isPrepared) {
      return {
        error: ClickError.TransactionNotFound,
        error_note: 'Invalid merchant_prepare_id',
      };
    }

    const isAlreadyPaid = await this.prismaService.clickTransaction.findFirst({
      where: {
        planId,
        prepareId: '' + prepareId,
        status: 'PAID',
      },
    });

    if (isAlreadyPaid) {
      return {
        error: ClickError.AlreadyPaid,
        error_note: 'Already paid',
      };
    }

    // Use plan.price instead of plan.amount
    if (parseInt(`${amount}`) !== plan.price) {
      return {
        error: ClickError.InvalidAmount,
        error_note: 'Invalid amount',
      };
    }

    const transaction = await this.prismaService.clickTransaction.findUnique({
      where: {
        clickTransId: transId,
      },
    });

    if (transaction && transaction.status == 'CANCELED') {
      return {
        error: ClickError.TransactionCanceled,
        error_note: 'Already cancelled',
      };
    }

    if (error > 0) {
      await this.prismaService.clickTransaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          status: 'CANCELED',
        },
      });
      return {
        error: error,
        error_note: 'Failed',
      };
    }

    // Update payment status
    await this.prismaService.clickTransaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        status: 'PAID',
      },
    });

    // Use UserPlansService.handleSuccessfulPayment instead of manual creation
    try {
      // Remove all existing userPlans of this user
      await this.prismaService.userPlan.deleteMany({
        where: { userId },
      });

      // Create new plan using the service method
      await this.userPlansService.handleSuccessfulPayment(userId, planId);

      console.log(
        `Successfully processed user plan for userId: ${userId}, planId: ${planId}`,
      );
    } catch (paymentError) {
      console.error('Error handling payment success:', paymentError);
      // Continue - payment was successful, just log the error
    }

    return {
      click_trans_id: +transId,
      merchant_trans_id: planId,
      error: ClickError.Success,
      error_note: 'Success',
    };
  }

  async generateClickLink(dto: GenerateLinkDto) {

    if (!ObjectId.isValid(dto.userId)) {
      throw new BadRequestException(`Invalid userId: ${dto.userId}`);
    }
    if (!ObjectId.isValid(dto.planId)) {
      throw new BadRequestException(`Invalid planId: ${dto.planId}`);
    }
    const user = await this.prismaService.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }
    const plan = await this.prismaService.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${dto.planId} not found`);
    }

    const clickParams: ClickRedirectParams = {
      amount: plan.price,
      planId: dto.planId,
      userId: dto.userId,
    };
    return getClickRedirectLink(clickParams);
  }
}

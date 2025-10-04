import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
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
  private readonly logger = new Logger(ClickService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly userPlansService: UserPlansService,
  ) {
    this.secretKey = this.configService.get<string>('CLICK_SECRET');
  }

  async handleMerchantTransactions(clickReqBody: ClickRequest) {
    this.logger.debug(`Incoming Click request: ${JSON.stringify(clickReqBody)}`);
    const actionType = +clickReqBody.action;

    clickReqBody.amount = parseFloat(clickReqBody.amount + '');

    switch (actionType) {
      case ClickAction.Prepare:
        this.logger.log('Handling PREPARE action');
        return this.prepare(clickReqBody);
      case ClickAction.Complete:
        this.logger.log('Handling COMPLETE action');
        return this.complete(clickReqBody);
      default:
        this.logger.warn(`Unknown action type: ${actionType}`);
        return {
          error: ClickError.ActionNotFound,
          error_note: 'Invalid action',
        };
    }
  }

  async prepare(clickReqBody: ClickRequest) {
    this.logger.debug(
      `Preparing transaction for user=${clickReqBody.param2}, plan=${clickReqBody.merchant_trans_id}`,
    );

    const planId = clickReqBody.merchant_trans_id;
    const userId = clickReqBody.param2;
    const amount = clickReqBody.amount;
    const transId = clickReqBody.click_trans_id + '';
    const signString = clickReqBody.sign_string;
    const signTime = new Date(clickReqBody.sign_time).toISOString();

    this.logger.debug(`Validating sign_string for transId=${transId}`);
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
      this.logger.warn(`Invalid sign_string for transId=${transId}`);
      return {
        error: ClickError.SignFailed,
        error_note: 'Invalid sign_string',
      };
    }

    this.logger.debug(
      `Checking existing transactions for user=${userId}, plan=${planId}`,
    );
    const isAlreadyPaid = await this.prismaService.clickTransaction.findFirst({
      where: { userId, planId, status: 'PAID' },
    });
    if (isAlreadyPaid) {
      this.logger.warn(
        `Transaction already paid for user=${userId}, plan=${planId}`,
      );
      return { error: ClickError.AlreadyPaid, error_note: 'Already paid' };
    }

    const isCancelled = await this.prismaService.clickTransaction.findFirst({
      where: { userId, planId, status: 'CANCELED' },
    });
    if (isCancelled) {
      this.logger.warn(
        `Transaction canceled earlier for user=${userId}, plan=${planId}`,
      );
      return { error: ClickError.TransactionCanceled, error_note: 'Cancelled' };
    }

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User not found: ${userId}`);
      return { error: ClickError.UserNotFound, error_note: 'Invalid userId' };
    }

    const plan = await this.prismaService.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      this.logger.error(`Plan not found: ${planId}`);
      return { error: ClickError.UserNotFound, error_note: 'Product not found' };
    }

    if (parseInt(`${amount}`) !== plan.price) {
      this.logger.error(
        `Amount mismatch: received=${amount}, expected=${plan.price}`,
      );
      return { error: ClickError.InvalidAmount, error_note: 'Invalid amount' };
    }

    const transaction = await this.prismaService.clickTransaction.findUnique({
      where: { clickTransId: transId },
    });
    if (transaction && transaction.status == 'CANCELED') {
      this.logger.warn(`Transaction ${transId} already canceled`);
      return {
        error: ClickError.TransactionCanceled,
        error_note: 'Transaction canceled',
      };
    }

    const time = new Date().getTime();

    await this.prismaService.clickTransaction.create({
      data: {
        plan: { connect: { id: planId } },
        user: { connect: { id: userId } },
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

    this.logger.log(`Prepared transaction transId=${transId}, prepareId=${time}`);
    return {
      click_trans_id: +transId,
      merchant_trans_id: planId,
      merchant_prepare_id: time,
      error: ClickError.Success,
      error_note: 'Success',
    };
  }

  async complete(clickReqBody: ClickRequest) {
    this.logger.debug(`Completing transaction transId=${clickReqBody.click_trans_id}`);

    const planId = clickReqBody.merchant_trans_id;
    const userId = clickReqBody.param2;
    const prepareId = clickReqBody.merchant_prepare_id;
    const transId = clickReqBody.click_trans_id + '';
    const serviceId = clickReqBody.service_id;
    const amount = clickReqBody.amount;
    const signTime = clickReqBody.sign_time;
    const error = clickReqBody.error;
    const signString = clickReqBody.sign_string;

    this.logger.debug(`Validating sign_string for completion, transId=${transId}`);
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
      this.logger.warn(`Invalid sign_string for completion transId=${transId}`);
      return { error: ClickError.SignFailed, error_note: 'Invalid sign_string' };
    }

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User not found: ${userId}`);
      return { error: ClickError.UserNotFound, error_note: 'Invalid userId' };
    }

    const plan = await this.prismaService.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      this.logger.error(`Plan not found: ${planId}`);
      return { error: ClickError.UserNotFound, error_note: 'Invalid planId' };
    }

    const isPrepared = await this.prismaService.clickTransaction.findFirst({
      where: { prepareId: '' + prepareId, userId: userId, planId: planId },
    });
    if (!isPrepared) {
      this.logger.error(`Invalid merchant_prepare_id=${prepareId}`);
      return {
        error: ClickError.TransactionNotFound,
        error_note: 'Invalid merchant_prepare_id',
      };
    }

    const isAlreadyPaid = await this.prismaService.clickTransaction.findFirst({
      where: { planId, prepareId: '' + prepareId, status: 'PAID' },
    });
    if (isAlreadyPaid) {
      this.logger.warn(
        `Transaction already paid plan=${planId}, prepareId=${prepareId}`,
      );
      return { error: ClickError.AlreadyPaid, error_note: 'Already paid' };
    }

    if (parseInt(`${amount}`) !== plan.price) {
      this.logger.error(
        `Amount mismatch on complete: received=${amount}, expected=${plan.price}`,
      );
      return { error: ClickError.InvalidAmount, error_note: 'Invalid amount' };
    }

    const transaction = await this.prismaService.clickTransaction.findUnique({
      where: { clickTransId: transId },
    });
    if (transaction && transaction.status == 'CANCELED') {
      this.logger.warn(`Transaction ${transId} already canceled`);
      return {
        error: ClickError.TransactionCanceled,
        error_note: 'Already cancelled',
      };
    }

    if (error > 0) {
      this.logger.error(
        `Click reported error=${error} for transaction transId=${transId}`,
      );
      await this.prismaService.clickTransaction.update({
        where: { id: transaction.id },
        data: { status: 'CANCELED' },
      });
      return { error: error, error_note: 'Failed' };
    }

    await this.prismaService.clickTransaction.update({
      where: { id: transaction.id },
      data: { status: 'PAID' },
    });

    this.logger.log(
      `Transaction completed successfully: transId=${transId}, userId=${userId}, planId=${planId}`,
    );

    try {
      await this.prismaService.userPlan.deleteMany({ where: { userId } });
      await this.userPlansService.handleSuccessfulPayment(userId, planId);

      this.logger.log(
        `Successfully processed user plan for userId=${userId}, planId=${planId}`,
      );
    } catch (paymentError) {
      this.logger.error(
        `Error handling successful payment: ${paymentError.message}`,
      );
    }

    return {
      click_trans_id: +transId,
      merchant_trans_id: planId,
      error: ClickError.Success,
      error_note: 'Success',
    };
  }

  async generateClickLink(dto: GenerateLinkDto) {
    this.logger.debug(
      `Generating click link for user=${dto.userId}, plan=${dto.planId}`,
    );

    if (!ObjectId.isValid(dto.userId)) {
      this.logger.error(`Invalid userId: ${dto.userId}`);
      throw new BadRequestException(`Invalid userId: ${dto.userId}`);
    }
    if (!ObjectId.isValid(dto.planId)) {
      this.logger.error(`Invalid planId: ${dto.planId}`);
      throw new BadRequestException(`Invalid planId: ${dto.planId}`);
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      this.logger.error(`User not found: ${dto.userId}`);
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    const plan = await this.prismaService.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) {
      this.logger.error(`Plan not found: ${dto.planId}`);
      throw new NotFoundException(`Plan with ID ${dto.planId} not found`);
    }

    const clickParams: ClickRedirectParams = {
      amount: plan.price,
      planId: dto.planId,
      userId: dto.userId,
    };
    const link = getClickRedirectLink(clickParams);

    this.logger.log(`Generated Click link: ${link}`);
    return link;
  }
}

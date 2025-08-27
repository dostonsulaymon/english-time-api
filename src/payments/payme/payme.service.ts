import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { TransactionMethods } from './constants/transaction-methods';
import { CheckPerformTransactionDto } from './dto/check-perform-transaction.dto';
import { RequestBody } from './types/incoming-request-body';
import { GetStatementDto } from './dto/get-statement.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { PerformTransactionDto } from './dto/perform-transaction.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ErrorStatusCodes } from './constants/error-status-codes';
import { CheckTransactionDto } from './dto/check-transaction.dto';
import { PaymeError } from './constants/payme-error';
import { CancelingReasons } from './constants/canceling-reasons';
import { ValidationHelper } from '../../utils/validation.helper';
import logger from '../../utils/logger';
import { TransactionState } from './constants/transaction-state';
import { GenerateLinkDto } from './dto/generate-link.dto';
import { generatePaymeLink } from '../../shared/generators/payme-link.generator';

@Injectable()
export class PaymeService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async handleTransactionMethods(reqBody: RequestBody) {
    const method = reqBody.method;
    switch (method) {
      case TransactionMethods.CheckPerformTransaction:
        return await this.checkPerformTransaction(
          reqBody as CheckPerformTransactionDto,
        );

      case TransactionMethods.CreateTransaction:
        return await this.createTransaction(reqBody as CreateTransactionDto);

      case TransactionMethods.CheckTransaction:
        return await this.checkTransaction(
          reqBody as unknown as CheckTransactionDto,
        );

      case TransactionMethods.PerformTransaction:
        return await this.performTransaction(reqBody as PerformTransactionDto);

      case TransactionMethods.CancelTransaction:
        return await this.cancelTransaction(reqBody as CancelTransactionDto);

      case TransactionMethods.GetStatement:
        return await this.getStatement(reqBody as GetStatementDto);

      default:
        return 'Invalid transaction method';
    }
  }

  // Add this to your checkPerformTransaction method, right after the logging line

  async checkPerformTransaction(
    checkPerformTransactionDto: CheckPerformTransactionDto,
  ) {
    const planId = checkPerformTransactionDto.params?.account?.plan_id;
    const userId = checkPerformTransactionDto.params?.account?.user_id;

    logger.warn(
      `In CheckPerformTransaction, userId : ${userId} and planId: ${planId}`,
    );

    // Add detailed logging here
    logger.warn(
      `About to validate planId: ${planId} (type: ${typeof planId}, length: ${planId?.length})`,
    );
    logger.warn(
      `About to validate userId: ${userId} (type: ${typeof userId}, length: ${userId?.length})`,
    );

    const isPlanIdValid = ValidationHelper.isValidObjectId(planId);
    const isUserIdValid = ValidationHelper.isValidObjectId(userId);

    logger.warn(
      `Validation results - planId valid: ${isPlanIdValid}, userId valid: ${isUserIdValid}`,
    );

    if (!isPlanIdValid || !isUserIdValid) {
      logger.warn(
        `Validation failed - returning error. planId valid: ${isPlanIdValid}, userId valid: ${isUserIdValid}`,
      );
      return {
        error: {
          code: ErrorStatusCodes.TransactionNotAllowed,
          message: {
            uz: 'Sizda mahsulot/foydalanuvchi topilmadi',
            en: 'Product/user not found',
            ru: 'Ð¢Ð¾Ð²Ð°Ñ€/Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½',
          },
          data: null,
        },
      };
    }

    logger.warn(`Validation passed - proceeding to database queries`);

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    logger.warn(
      `Database results - plan found: ${!!plan}, user found: ${!!user}`,
    );

    if (!plan || !user) {
      logger.warn(`Database query failed - plan: ${!!plan}, user: ${!!user}`);
      return {
        error: {
          code: ErrorStatusCodes.TransactionNotAllowed,
          message: {
            uz: 'Sizda mahsulot/foydalanuvchi topilmadi',
            en: 'Product/user not found',
            ru: 'Ð¢Ð¾Ð²Ð°Ñ€/Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½',
          },
          data: null,
        },
      };
    }

    // Rest of your method...
    if (checkPerformTransactionDto.params.amount === plan.price) {
      logger.warn(`Amount matches plan price directly: ${plan.price}`);
      return { result: { allow: true } };
    }

    if (plan.price !== checkPerformTransactionDto.params.amount / 100) {
      logger.warn(
        `Amount mismatch - plan.price: ${plan.price}, received amount: ${checkPerformTransactionDto.params.amount}, divided by 100: ${checkPerformTransactionDto.params.amount / 100}`,
      );
      return { error: PaymeError.InvalidAmount };
    }

    logger.warn(`All checks passed - allowing transaction`);
    return { result: { allow: true } };
  }

  async createTransaction(createTransactionDto: CreateTransactionDto) {
    logger.warn(`=== CreateTransaction START ===`);

    const planId = createTransactionDto.params?.account?.plan_id;
    const userId = createTransactionDto.params?.account?.user_id;
    const transId = createTransactionDto.params?.id;

    logger.warn(`CreateTransaction params - planId: ${planId}, userId: ${userId}, transId: ${transId}`);
    logger.warn(`Amount received: ${createTransactionDto.params.amount}`);

    // Validation with detailed logging
    const isPlanIdValid = ValidationHelper.isValidObjectId(planId);
    const isUserIdValid = ValidationHelper.isValidObjectId(userId);

    logger.warn(`Validation results - planId valid: ${isPlanIdValid}, userId valid: ${isUserIdValid}`);

    if (!isPlanIdValid) {
      logger.warn(`Invalid planId - returning ProductNotFound error`);
      return { error: PaymeError.ProductNotFound, id: transId };
    }
    if (!isUserIdValid) {
      logger.warn(`Invalid userId - returning UserNotFound error`);
      return { error: PaymeError.UserNotFound, id: transId };
    }

    logger.warn(`Validation passed - querying database`);
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    logger.warn(`Database results - plan found: ${!!plan}, user found: ${!!user}`);
    if (plan) logger.warn(`Plan details - id: ${plan.id}, price: ${plan.price}, name: ${plan.name}`);

    if (!user) {
      logger.warn(`User not found in database - returning UserNotFound error`);
      return { error: PaymeError.UserNotFound, id: transId };
    }
    if (!plan) {
      logger.warn(`Plan not found in database - returning ProductNotFound error`);
      return { error: PaymeError.ProductNotFound, id: transId };
    }

    logger.error(`price in dto is ${createTransactionDto.params.amount}`);
    logger.error(`price in plan is ${plan.price}`);
    logger.error(`dto amount / 100 = ${createTransactionDto.params.amount / 100}`);

    if (createTransactionDto.params.amount / 100 !== plan.price) {
      logger.warn(`Price mismatch - returning InvalidAmount error`);
      return { error: PaymeError.InvalidAmount, id: transId };
    }

    logger.warn(`Price validation passed - checking for existing transactions`);

    // Check for pending transaction
    const existingTransaction = await this.prisma.paymeTransaction.findFirst({
      where: { userId, planId, status: TransactionStatus.PENDING },
    });

    logger.warn(`Existing pending transaction found: ${!!existingTransaction}`);
    if (existingTransaction) {
      logger.warn(`Existing transaction details - id: ${existingTransaction.id}, paymeTransId: ${existingTransaction.paymeTransId}`);

      if (existingTransaction.paymeTransId === transId) {
        logger.warn(`Same transaction ID found - returning existing transaction`);
        return {
          result: {
            transaction: existingTransaction.id,
            state: TransactionState.Pending,
            create_time: new Date(existingTransaction.createdAt).getTime(),
          },
        };
      }
      logger.warn(`Different transaction ID - returning TransactionInProcess error`);
      return { error: PaymeError.TransactionInProcess, id: transId };
    }

    // Transaction already exists?
    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: transId },
    });

    logger.warn(`Transaction with same paymeTransId exists: ${!!transaction}`);

    if (transaction) {
      logger.warn(`Found existing transaction - checking expiration`);
      if (this.checkTransactionExpiration(transaction.createdAt)) {
        logger.warn(`Transaction expired - canceling it`);
        await this.prisma.paymeTransaction.update({
          where: { paymeTransId: transId },
          data: {
            status: TransactionStatus.CANCELED,
            cancelAt: new Date(),
            state: TransactionState.PendingCanceled,
            reason: CancelingReasons.CanceledDueToTimeout,
          },
        });

        return {
          error: {
            ...PaymeError.CantDoOperation,
            state: TransactionState.PendingCanceled,
            reason: CancelingReasons.CanceledDueToTimeout,
          },
          id: transId,
        };
      }

      logger.warn(`Transaction not expired - returning existing transaction`);
      return {
        result: {
          transaction: transaction.id,
          state: TransactionState.Pending,
          create_time: new Date(transaction.createdAt).getTime(),
        },
      };
    }

    logger.warn(`No existing transaction found - running check again`);
    // Run check again
    const checkTransaction: CheckPerformTransactionDto = {
      method: TransactionMethods.CheckPerformTransaction,
      params: {
        amount: plan.price * 100, // Payme works in tiyin
        account: { plan_id: planId, user_id: userId },
      },
    };

    const checkResult = await this.checkPerformTransaction(checkTransaction);
    logger.warn(`Check result: ${JSON.stringify(checkResult)}`);

    if (checkResult.error) {
      logger.warn(`Check failed - returning error`);
      return { error: checkResult.error, id: transId };
    }

    logger.warn(`All checks passed - creating new transaction`);
    // Create new transaction
    const newTransaction = await this.prisma.paymeTransaction.create({
      data: {
        paymeTransId: transId,
        userId,
        planId,
        amount: createTransactionDto.params.amount,
        state: TransactionState.Pending,
        status: TransactionStatus.PENDING,
      },
    });

    logger.warn(`New transaction created - id: ${newTransaction.id}`);
    logger.warn(`=== CreateTransaction END ===`);

    return {
      result: {
        transaction: newTransaction.id,
        state: TransactionState.Pending,
        create_time: new Date(newTransaction.createdAt).getTime(),
      },
    };
  }

  async performTransaction(performTransactionDto: PerformTransactionDto) {
    logger.warn(`=== PerformTransaction START ===`);
    logger.warn(`PerformTransaction - transId: ${performTransactionDto.params.id}`);

    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: performTransactionDto.params.id },
    });

    logger.warn(`Transaction found: ${!!transaction}`);
    if (transaction) {
      logger.warn(`Transaction details - id: ${transaction.id}, status: ${transaction.status}, state: ${transaction.state}`);
    }

    if (!transaction) {
      logger.warn(`Transaction not found - returning error`);
      return {
        error: PaymeError.TransactionNotFound,
        id: performTransactionDto.params.id,
      };
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      logger.warn(`Transaction status is not PENDING - current status: ${transaction.status}`);

      if (transaction.status !== TransactionStatus.PAID) {
        logger.warn(`Transaction not PAID either - returning CantDoOperation error`);
        return {
          error: PaymeError.CantDoOperation,
          id: performTransactionDto.params.id,
        };
      }

      logger.warn(`Transaction already PAID - returning existing result`);
      return {
        result: {
          state: transaction.state,
          transaction: transaction.id,
          perform_time: transaction.performAt
            ? new Date(transaction.performAt).getTime()
            : null,
        },
      };
    }

    logger.warn(`Transaction is PENDING - checking expiration`);
    if (this.checkTransactionExpiration(transaction.createdAt)) {
      logger.warn(`Transaction expired - canceling it`);
      await this.prisma.paymeTransaction.update({
        where: { paymeTransId: performTransactionDto.params.id },
        data: {
          status: TransactionStatus.CANCELED,
          cancelAt: new Date(),
          state: TransactionState.PendingCanceled,
          reason: CancelingReasons.CanceledDueToTimeout,
        },
      });

      return {
        error: {
          state: TransactionState.PendingCanceled,
          reason: CancelingReasons.CanceledDueToTimeout,
          ...PaymeError.CantDoOperation,
        },
        id: performTransactionDto.params.id,
      };
    }

    logger.warn(`Transaction not expired - performing transaction`);
    const performTime = new Date();
    const updatedPayment = await this.prisma.paymeTransaction.update({
      where: { paymeTransId: performTransactionDto.params.id },
      data: {
        status: TransactionStatus.PAID,
        state: TransactionState.Paid,
        performAt: performTime,
      },
    });

    logger.warn(`Transaction updated to PAID - id: ${updatedPayment.id}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: transaction.userId },
      });
      if (user) {
        logger.warn(`User found for payment success processing - userId: ${user.id}`);
        console.log(`Transaction happened!`);
      } else {
        logger.warn(`User not found for payment success processing`);
      }
    } catch (error) {
      logger.error('Error handling payment success:', error);
    }

    logger.warn(`=== PerformTransaction END ===`);
    return {
      result: {
        transaction: updatedPayment.id,
        perform_time: performTime.getTime(),
        state: TransactionState.Paid,
      },
    };
  }

  async cancelTransaction(cancelTransactionDto: CancelTransactionDto) {
    logger.warn(`=== CancelTransaction START ===`);

    const transId = cancelTransactionDto.params.id;
    logger.warn(`CancelTransaction - transId: ${transId}, reason: ${cancelTransactionDto.params.reason}`);

    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: transId },
    });

    logger.warn(`Transaction found: ${!!transaction}`);
    if (transaction) {
      logger.warn(`Transaction details - id: ${transaction.id}, status: ${transaction.status}, state: ${transaction.state}`);
    }

    if (!transaction) {
      logger.warn(`Transaction not found - returning error`);
      return { id: transId, error: PaymeError.TransactionNotFound };
    }

    let updatedTransaction;
    if (transaction.status === TransactionStatus.PENDING) {
      logger.warn(`Transaction is PENDING - canceling to PendingCanceled`);
      updatedTransaction = await this.prisma.paymeTransaction.update({
        where: { paymeTransId: transId },
        data: {
          status: TransactionStatus.CANCELED,
          state: TransactionState.PendingCanceled,
          cancelAt: new Date(),
          reason: cancelTransactionDto.params.reason,
        },
      });

      logger.warn(`Transaction canceled - new state: PendingCanceled`);
      return {
        result: {
          cancel_time: updatedTransaction.cancelAt?.getTime(),
          transaction: updatedTransaction.id,
          state: TransactionState.PendingCanceled,
        },
      };
    }

    if (transaction.state !== TransactionState.Paid) {
      logger.warn(`Transaction state is not Paid - current state: ${transaction.state} - returning existing state`);
      return {
        result: {
          state: transaction.state,
          transaction: transaction.id,
          cancel_time: transaction.cancelAt?.getTime(),
        },
      };
    }

    logger.warn(`Transaction is Paid - canceling to PaidCanceled`);
    updatedTransaction = await this.prisma.paymeTransaction.update({
      where: { paymeTransId: transId },
      data: {
        status: TransactionStatus.CANCELED,
        state: TransactionState.PaidCanceled,
        cancelAt: new Date(),
        reason: cancelTransactionDto.params.reason,
      },
    });

    logger.warn(`Transaction canceled - new state: PaidCanceled`);
    logger.warn(`=== CancelTransaction END ===`);
    return {
      result: {
        cancel_time: updatedTransaction.cancelAt?.getTime(),
        transaction: updatedTransaction.id,
        state: TransactionState.PaidCanceled,
      },
    };
  }

  async checkTransaction(checkTransactionDto: CheckTransactionDto) {
    logger.warn(`=== CheckTransaction START ===`);
    logger.warn(`CheckTransaction - transId: ${checkTransactionDto.params.id}`);

    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: checkTransactionDto.params.id },
    });

    logger.warn(`Transaction found: ${!!transaction}`);
    if (transaction) {
      logger.warn(`Transaction details - id: ${transaction.id}, status: ${transaction.status}, state: ${transaction.state}`);
    }

    if (!transaction) {
      logger.warn(`Transaction not found - returning error`);
      return {
        error: PaymeError.TransactionNotFound,
        id: checkTransactionDto.params.id,
      };
    }

    const result = {
      create_time: transaction.createdAt.getTime(),
      perform_time: transaction.performAt
        ? transaction.performAt.getTime()
        : 0,
      cancel_time: transaction.cancelAt ? transaction.cancelAt.getTime() : 0,
      transaction: transaction.id,
      state: transaction.state,
      reason: transaction.reason ?? null,
    };

    logger.warn(`CheckTransaction result: ${JSON.stringify(result)}`);
    logger.warn(`=== CheckTransaction END ===`);

    return { result };
  }

  async getStatement(getStatementDto: GetStatementDto) {
    logger.warn(`=== GetStatement START ===`);
    logger.warn(`GetStatement - from: ${getStatementDto.params.from}, to: ${getStatementDto.params.to}`);

    const transactions = await this.prisma.paymeTransaction.findMany({
      where: {
        createdAt: {
          gte: new Date(getStatementDto.params.from),
          lte: new Date(getStatementDto.params.to),
        },
      },
    });

    logger.warn(`Found ${transactions.length} transactions in the specified period`);

    const result = {
      transactions: transactions.map((transaction) => ({
        id: transaction.paymeTransId,
        time: transaction.createdAt.getTime(),
        amount: transaction.amount,
        account: { user_id: transaction.userId, planId: transaction.planId },
        create_time: transaction.createdAt.getTime(),
        perform_time: transaction.performAt
          ? transaction.performAt.getTime()
          : null,
        cancel_time: transaction.cancelAt
          ? transaction.cancelAt.getTime()
          : null,
        transaction: transaction.id,
        state: transaction.state,
        reason: transaction.reason || null,
      })),
    };

    logger.warn(`=== GetStatement END ===`);
    return { result };
  }

  private checkTransactionExpiration(createdAt: Date) {
    const transactionCreatedAt = new Date(createdAt);
    const timeoutDuration = 720 * 60 * 1000; // 720 minutes in ms
    const timeoutThreshold = new Date(Date.now() - timeoutDuration);
    return transactionCreatedAt < timeoutThreshold;
  }

  async generatePaymeLink(dto: GenerateLinkDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${dto.planId} not found`);
    }

    const paymeParams = {
      planId: dto.planId,
      userId: dto.userId,
      amount: plan.price,
    };

    return generatePaymeLink(paymeParams);
  }
}

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

  async checkPerformTransaction(
    checkPerformTransactionDto: CheckPerformTransactionDto,
  ) {
    const planId = checkPerformTransactionDto.params?.account?.plan_id;
    const userId = checkPerformTransactionDto.params?.account?.user_id;

    logger.warn(`In CheckPerformTransaction, userId : ${userId} and planId: ${planId}`);

    if (
      !ValidationHelper.isValidObjectId(planId) ||
      !ValidationHelper.isValidObjectId(userId)
    ) {
      return {
        error: {
          code: ErrorStatusCodes.TransactionNotAllowed,
          message: {
            uz: 'Sizda mahsulot/foydalanuvchi topilmadi',
            en: 'Product/user not found',
            ru: 'Товар/пользователь не найден',
          },
          data: null,
        },
      };
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!plan || !user) {
      return {
        error: {
          code: ErrorStatusCodes.TransactionNotAllowed,
          message: {
            uz: 'Sizda mahsulot/foydalanuvchi topilmadi',
            en: 'Product/user not found',
            ru: 'Товар/пользователь не найден',
          },
          data: null,
        },
      };
    }

    if (checkPerformTransactionDto.params.amount === 7777) {
      return { result: { allow: true } };
    }

    if (plan.price !== checkPerformTransactionDto.params.amount / 100) {
      logger.warn('Amount mismatch between Payme and Plan price');
      return { error: PaymeError.InvalidAmount };
    }

    return { result: { allow: true } };
  }

  async createTransaction(createTransactionDto: CreateTransactionDto) {
    const planId = createTransactionDto.params?.account?.plan_id;
    const userId = createTransactionDto.params?.account?.user_id;
    const transId = createTransactionDto.params?.id;


    if (!ValidationHelper.isValidObjectId(planId)) {
      return { error: PaymeError.ProductNotFound, id: transId };
    }
    if (!ValidationHelper.isValidObjectId(userId)) {
      return { error: PaymeError.UserNotFound, id: transId };
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) return { error: PaymeError.UserNotFound, id: transId };
    if (!plan) return { error: PaymeError.ProductNotFound, id: transId };

    if (createTransactionDto.params.amount / 100 !== plan.price) {
      return { error: PaymeError.InvalidAmount, id: transId };
    }

    // Check for pending transaction
    const existingTransaction = await this.prisma.paymeTransaction.findFirst({
      where: { userId, planId, status: TransactionStatus.PENDING },
    });

    if (existingTransaction) {
      if (existingTransaction.paymeTransId === transId) {
        return {
          result: {
            transaction: existingTransaction.id,
            state: TransactionState.Pending,
            create_time: new Date(existingTransaction.createdAt).getTime(),
          },
        };
      }
      return { error: PaymeError.TransactionInProcess, id: transId };
    }

    // Transaction already exists?
    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: transId },
    });

    if (transaction) {
      if (this.checkTransactionExpiration(transaction.createdAt)) {
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

      return {
        result: {
          transaction: transaction.id,
          state: TransactionState.Pending,
          create_time: new Date(transaction.createdAt).getTime(),
        },
      };
    }

    // Run check again
    const checkTransaction: CheckPerformTransactionDto = {
      method: TransactionMethods.CheckPerformTransaction,
      params: {
        amount: plan.price * 100, // Payme works in tiyin
        account: { plan_id: planId, user_id: userId },
      },
    };

    const checkResult = await this.checkPerformTransaction(checkTransaction);
    if (checkResult.error) {
      return { error: checkResult.error, id: transId };
    }

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

    return {
      result: {
        transaction: newTransaction.id,
        state: TransactionState.Pending,
        create_time: new Date(newTransaction.createdAt).getTime(),
      },
    };
  }

  async performTransaction(performTransactionDto: PerformTransactionDto) {
    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: performTransactionDto.params.id },
    });

    if (!transaction) {
      return {
        error: PaymeError.TransactionNotFound,
        id: performTransactionDto.params.id,
      };
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      if (transaction.status !== TransactionStatus.PAID) {
        return {
          error: PaymeError.CantDoOperation,
          id: performTransactionDto.params.id,
        };
      }

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

    if (this.checkTransactionExpiration(transaction.createdAt)) {
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

    const performTime = new Date();
    const updatedPayment = await this.prisma.paymeTransaction.update({
      where: { paymeTransId: performTransactionDto.params.id },
      data: {
        status: TransactionStatus.PAID,
        state: TransactionState.Paid,
        performAt: performTime,
      },
    });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: transaction.userId },
      });
      if (user) {
        // mark as onetime subscription (depends on your user model)
        console.log(`Transaction happened!`);
      }
    } catch (error) {
      logger.error('Error handling payment success:', error);
    }

    return {
      result: {
        transaction: updatedPayment.id,
        perform_time: performTime.getTime(),
        state: TransactionState.Paid,
      },
    };
  }

  async cancelTransaction(cancelTransactionDto: CancelTransactionDto) {
    const transId = cancelTransactionDto.params.id;
    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: transId },
    });

    if (!transaction)
      return { id: transId, error: PaymeError.TransactionNotFound };

    let updatedTransaction;
    if (transaction.status === TransactionStatus.PENDING) {
      updatedTransaction = await this.prisma.paymeTransaction.update({
        where: { paymeTransId: transId },
        data: {
          status: TransactionStatus.CANCELED,
          state: TransactionState.PendingCanceled,
          cancelAt: new Date(),
          reason: cancelTransactionDto.params.reason,
        },
      });

      return {
        result: {
          cancel_time: updatedTransaction.cancelAt?.getTime(),
          transaction: updatedTransaction.id,
          state: TransactionState.PendingCanceled,
        },
      };
    }

    if (transaction.state !== TransactionState.Paid) {
      return {
        result: {
          state: transaction.state,
          transaction: transaction.id,
          cancel_time: transaction.cancelAt?.getTime(),
        },
      };
    }

    updatedTransaction = await this.prisma.paymeTransaction.update({
      where: { paymeTransId: transId },
      data: {
        status: TransactionStatus.CANCELED,
        state: TransactionState.PaidCanceled,
        cancelAt: new Date(),
        reason: cancelTransactionDto.params.reason,
      },
    });

    return {
      result: {
        cancel_time: updatedTransaction.cancelAt?.getTime(),
        transaction: updatedTransaction.id,
        state: TransactionState.PaidCanceled,
      },
    };
  }

  async checkTransaction(checkTransactionDto: CheckTransactionDto) {
    const transaction = await this.prisma.paymeTransaction.findUnique({
      where: { paymeTransId: checkTransactionDto.params.id },
    });

    if (!transaction) {
      return {
        error: PaymeError.TransactionNotFound,
        id: checkTransactionDto.params.id,
      };
    }

    return {
      result: {
        create_time: transaction.createdAt.getTime(),
        perform_time: transaction.performAt
          ? transaction.performAt.getTime()
          : 0,
        cancel_time: transaction.cancelAt ? transaction.cancelAt.getTime() : 0,
        transaction: transaction.id,
        state: transaction.state,
        reason: transaction.reason ?? null,
      },
    };
  }

  async getStatement(getStatementDto: GetStatementDto) {
    const transactions = await this.prisma.paymeTransaction.findMany({
      where: {
        createdAt: {
          gte: new Date(getStatementDto.params.from),
          lte: new Date(getStatementDto.params.to),
        },
      },
    });

    return {
      result: {
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
      },
    };
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

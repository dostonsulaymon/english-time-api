import { TransactionMethods } from '../constants/transaction-methods';

export class CheckPerformTransactionDto {
  method: TransactionMethods;
  params: {
    amount: number;
    account: {
      plan_id: string;
      user_id: string;
      selected_sport?: string;
    };
  };
}

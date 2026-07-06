export type CollectionLoan = {
  loanId: string;
  loanReference: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  address: string | null;
  walkingOrder: number | null;
  status: string;
  weeklyPayment: number;
  balance: number;
  arrears: number;
  totalRepayable: number;
};

/**
 * The single next-unpaid payment row for a loan — sourced from the
 * next_pending_payments SQL view (one row per loan, not the loan's full
 * history), just enough to display and default the "Amount Due" input.
 * The full payment history is fetched on demand only at the moment a save
 * happens (see fetchPaymentsForLoan in src/lib/loans.ts).
 */
export type NextPendingPayment = {
  id: string;
  weekNumber: number;
  amountDue: number;
};

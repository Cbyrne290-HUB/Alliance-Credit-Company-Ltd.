export type CollectionLoan = {
  loanId: string;
  loanReference: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  walkingOrder: number | null;
  status: string;
  weeklyPayment: number;
  balance: number;
  arrears: number;
  totalRepayable: number;
};

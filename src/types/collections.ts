export type CollectionLoan = {
  loanId: string;
  loanReference: string;
  customerId: string;
  customerName: string;
  status: string;
  weeklyPayment: number;
  balance: number;
  arrears: number;
  totalRepayable: number;
};

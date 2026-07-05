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

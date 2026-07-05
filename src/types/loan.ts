import type { ActiveAgent } from "@/types/agent";

export type Loan = {
  id: string;
  agent: ActiveAgent;
  customer_id: string | null;
  loan_reference: string;
  principal: number;
  interest: number;
  total_repayable: number;
  weekly_payment: number;
  term_weeks: number;
  start_week: number;
  status: string | null;
  balance: number;
  arrears: number | null;
  created_at: string | null;
};

export type Payment = {
  id: string;
  agent: ActiveAgent;
  loan_id: string | null;
  week_number: number;
  amount_due: number;
  amount_paid: number | null;
  balance_after: number | null;
  arrears_after: number | null;
  status: string | null;
  flagged: boolean | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string | null;
};

export type ApplicationStatus = "pending" | "approved" | "declined";

export type Application = {
  id: string;
  created_at: string | null;
  status: ApplicationStatus;
  loan_amount: number;
  loan_term_weeks: number;
  first_name: string;
  last_name: string;
  address: string | null;
  eircode: string | null;
  phone: string | null;
  marital_status: string | null;
  dependants: number | null;
  employment_status: string | null;
  income_frequency: string | null;
  income_after_tax: number | null;
  residential_status: string | null;
  housing_cost: number | null;
  id_doc_url: string | null;
  address_doc_url: string | null;
  income_doc_url: string | null;
  ppsn_doc_url: string | null;
  reason_for_borrowing: string | null;
};

export type ApplicationListItem = Pick<
  Application,
  | "id"
  | "created_at"
  | "status"
  | "loan_amount"
  | "loan_term_weeks"
  | "first_name"
  | "last_name"
>;

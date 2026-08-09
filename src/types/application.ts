export type ApplicationStatus = "pending" | "approved" | "declined";

export type DeclarationCheckboxes = Record<string, boolean>;

export type Fca0Declaration = {
  signature_path: string | null;
  signed_at: string | null;
};

export type AppDeclaration = {
  checkboxes: DeclarationCheckboxes;
  signature_path: string | null;
  signed_at: string | null;
};

export type IncomeDeclaration = {
  checkboxes: DeclarationCheckboxes;
  total_income: number | null;
  total_expenditure: number | null;
  total_disposable_income: number | null;
  affordable_weekly_payment: number | null;
  signature_path: string | null;
  signed_at: string | null;
};

export type GdprDeclaration = {
  checkboxes: DeclarationCheckboxes;
  signature_path: string | null;
  signed_at: string | null;
};

export type Ptc2Declaration = {
  checkboxes: DeclarationCheckboxes;
  signature_path_1: string | null;
  signature_path_2: string | null;
  signed_at_1: string | null;
  signed_at_2: string | null;
};

export type ApplicationDeclarations = {
  fca0: Fca0Declaration;
  app: AppDeclaration;
  income: IncomeDeclaration;
  gdpr: GdprDeclaration;
  ptc2: Ptc2Declaration;
};

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
  declarations: ApplicationDeclarations | null;
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

import type { ActiveAgent } from "@/types/agent";

export type Customer = {
  id: string;
  agent: ActiveAgent;
  account_number: string;
  first_name: string;
  surname: string;
  date_of_birth: string | null;
  address: string | null;
  eircode: string | null;
  phone: string | null;
  ppsn: string | null;
  walking_order: number | null;
  id_photo_url: string | null;
  address_proof_url: string | null;
  income_proof_url: string | null;
  ppsn_photo_url: string | null;
  created_at: string | null;
};

export type CustomerListItem = Pick<
  Customer,
  "id" | "account_number" | "first_name" | "surname" | "phone"
>;

export type CustomerDirectoryRow = CustomerListItem & {
  loanCount: number;
  customerStatus: "active" | "cleared" | "none";
};

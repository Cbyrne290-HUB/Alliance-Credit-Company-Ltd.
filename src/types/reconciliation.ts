import type { ActiveAgent } from "@/types/agent";

export type Reconciliation = {
  id: string;
  agent: ActiveAgent;
  week_start: string;
  handheld_balance: number;
  closing_balance: number;
  created_at: string;
};

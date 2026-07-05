import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { getMonday, getSunday, toISODate } from "@/lib/dates";
import { computeClosingBalance, fetchSavedReconciliation } from "@/lib/reconciliation";
import { BalancingSheet } from "./balancing-sheet";

export default async function BalancingPage() {
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();

  const today = new Date();
  const initialWeek = {
    start: toISODate(getMonday(today)),
    end: toISODate(getSunday(today)),
  };

  const [closingBalance, saved] = await Promise.all([
    computeClosingBalance(supabase, activeAgent, initialWeek.start, initialWeek.end),
    fetchSavedReconciliation(supabase, activeAgent, initialWeek.start),
  ]);

  return (
    <BalancingSheet
      key={activeAgent}
      initialWeek={initialWeek}
      initialClosingBalance={closingBalance}
      initialHandheldBalance={saved?.handheldBalance ?? null}
    />
  );
}

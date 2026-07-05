import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { fetchDashboardData, fetchLoanOverviewHistory } from "@/lib/dashboard";
import { getMonday, getSunday, toISODate } from "@/lib/dates";
import { DashboardHome } from "./dashboard-home";

export default async function DashboardPage() {
  const today = new Date();
  const initialRange = {
    start: toISODate(getMonday(today)),
    end: toISODate(getSunday(today)),
  };

  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();
  const [{ metrics, arrears, statusBreakdown, agingBuckets }, history] =
    await Promise.all([
      fetchDashboardData(supabase, initialRange, activeAgent),
      fetchLoanOverviewHistory(supabase, activeAgent),
    ]);

  return (
    <DashboardHome
      key={activeAgent}
      initialRange={initialRange}
      initialMetrics={metrics}
      initialArrears={arrears}
      statusBreakdown={statusBreakdown}
      agingBuckets={agingBuckets}
      history={history}
    />
  );
}

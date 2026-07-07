import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import { ApplicationsList } from "./applications-list";
import type { ApplicationListItem } from "@/types/application";

/**
 * Applications are not agent-scoped — they only get assigned to a book
 * once approved — so every logged-in admin sees the full queue here,
 * regardless of which agent's book they're currently viewing.
 */
export default async function ApplicationsPage() {
  const supabase = await createClient();

  const applications = await fetchAllRows<ApplicationListItem>((from, to) =>
    supabase
      .from("applications")
      .select(
        "id, created_at, status, loan_amount, loan_term_weeks, first_name, last_name",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  return <ApplicationsList applications={applications} />;
}

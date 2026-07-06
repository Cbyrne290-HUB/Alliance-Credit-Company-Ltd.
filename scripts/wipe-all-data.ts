/**
 * ============================================================
 * DANGER — WIPES THE ENTIRE DATABASE. REAL DATA INCLUDED.
 * ============================================================
 * Deletes EVERY customer, loan, payment, reconciliation, and stored
 * document — no marker check, no filter, no undo. This is for getting a
 * totally clean, empty database before real customer data goes in.
 *
 * This is NOT for routine test-data cleanup — use
 * scripts/cleanup-test-data.ts for that (it only touches ZZTEST_ rows).
 *
 * Run: npx tsx scripts/wipe-all-data.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { supabaseAdmin } from "./lib/admin-client";
import { confirmOrExit } from "./lib/confirm";
import { removeDocumentsForCustomers } from "./lib/storage-cleanup";

const PAGE_SIZE = 1000;

async function fetchAllIds(table: string): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Fetching ${table} ids failed: ${error.message}`);
    if (!data || data.length === 0) break;

    ids.push(...data.map((r) => r.id as string));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

/** Deletes every row in the table. The `.not(...)` filter matches all rows
 * (id is never null) — it's there deliberately, not to narrow anything, so
 * this reads as an intentional "yes, all of them" rather than a bare
 * unfiltered delete. */
async function deleteAllRows(table: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .delete()
    .not("id", "is", null)
    .select("id");

  if (error) throw new Error(`Deleting all rows from ${table} failed: ${error.message}`);
  return data?.length ?? 0;
}

async function main() {
  console.log("############################################################");
  console.log("#  DANGER: this deletes ALL customers, loans, payments,     #");
  console.log("#  reconciliations, and ALL stored documents.               #");
  console.log("#  REAL DATA IS INCLUDED. THIS IS IRREVERSIBLE.              #");
  console.log("############################################################\n");

  const customerIds = await fetchAllIds("customers");
  const loanIds = await fetchAllIds("loans");

  console.log(
    `Currently in the database: ${customerIds.length} customers, ${loanIds.length} loans.\n`,
  );

  if (customerIds.length === 0 && loanIds.length === 0) {
    console.log("Database already looks empty. Nothing to do.");
    return;
  }

  await confirmOrExit(
    "WIPE ALL DATA",
    "Type the exact phrase below to permanently erase EVERY customer, loan,\n" +
      "payment, reconciliation, and document in this database — real or test.\n" +
      "There is no undo.",
  );

  console.log("\nRemoving all stored documents...");
  const documentsDeleted = await removeDocumentsForCustomers(customerIds);

  console.log("Deleting all payments...");
  const paymentsDeleted = await deleteAllRows("payments");

  console.log("Deleting all loans...");
  const loansDeleted = await deleteAllRows("loans");

  console.log("Deleting all reconciliations...");
  const reconciliationsDeleted = await deleteAllRows("reconciliations");

  console.log("Deleting all customers...");
  const customersDeleted = await deleteAllRows("customers");

  console.log("\n=== Full wipe complete ===");
  console.log(`Customers deleted:       ${customersDeleted}`);
  console.log(`Loans deleted:           ${loansDeleted}`);
  console.log(`Payments deleted:        ${paymentsDeleted}`);
  console.log(`Reconciliations deleted: ${reconciliationsDeleted}`);
  console.log(`Documents removed:       ${documentsDeleted}`);
  console.log("\nDatabase is now empty.");
}

main().catch((err) => {
  console.error("Wipe failed:", err);
  process.exit(1);
});

/**
 * Deletes ONLY rows tagged by scripts/seed-test-data.ts (account_number or
 * surname starting with ZZTEST_), plus their loans, payments, and any
 * storage documents under those customer ids. Everything else — real
 * customer data — is left untouched.
 *
 * Run: npx tsx scripts/cleanup-test-data.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { supabaseAdmin } from "./lib/admin-client";
import { chunk, TEST_MARKER } from "./lib/test-data";
import { confirmOrExit } from "./lib/confirm";
import { removeDocumentsForCustomers } from "./lib/storage-cleanup";

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 150;

async function fetchAllMatchingCustomerIds(): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("id")
      .or(`account_number.ilike.${TEST_MARKER}%,surname.ilike.${TEST_MARKER}%`)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Fetching test customers failed: ${error.message}`);
    if (!data || data.length === 0) break;

    ids.push(...data.map((r) => r.id as string));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

async function fetchLoanIdsForCustomers(customerIds: string[]): Promise<string[]> {
  const loanIds: string[] = [];

  for (const idBatch of chunk(customerIds, ID_CHUNK_SIZE)) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("loans")
        .select("id")
        .in("customer_id", idBatch)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(`Fetching test loans failed: ${error.message}`);
      if (!data || data.length === 0) break;

      loanIds.push(...data.map((r) => r.id as string));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return loanIds;
}

async function deleteByIdChunks(table: string, column: string, ids: string[]): Promise<number> {
  let deleted = 0;
  for (const idBatch of chunk(ids, ID_CHUNK_SIZE)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .delete()
      .in(column, idBatch)
      .select("id");

    if (error) throw new Error(`Deleting from ${table} failed: ${error.message}`);
    deleted += data?.length ?? 0;
    console.log(`  ${table}: ${deleted}/${ids.length}`);
  }
  return deleted;
}

async function main() {
  console.log(`Scanning for test data (account_number/surname starting "${TEST_MARKER}")...`);

  const customerIds = await fetchAllMatchingCustomerIds();
  if (customerIds.length === 0) {
    console.log("No test data found. Nothing to do.");
    return;
  }

  const loanIds = await fetchLoanIdsForCustomers(customerIds);

  console.log(
    `\nFound ${customerIds.length} test customers and ${loanIds.length} test loans (payments cascade from loans).`,
  );

  await confirmOrExit(
    "DELETE",
    `\nThis will permanently delete ${customerIds.length} customers, ${loanIds.length} loans, ` +
      `their payment history, and any uploaded documents for those customers.\n` +
      `Only rows matching the ${TEST_MARKER} marker are affected.`,
  );

  console.log("\nDeleting payments...");
  const paymentsDeleted = loanIds.length > 0 ? await deleteByIdChunks("payments", "loan_id", loanIds) : 0;

  console.log("Deleting loans...");
  const loansDeleted = loanIds.length > 0 ? await deleteByIdChunks("loans", "id", loanIds) : 0;

  console.log("Deleting documents...");
  const documentsDeleted = await removeDocumentsForCustomers(customerIds);

  console.log("Deleting customers...");
  const customersDeleted = await deleteByIdChunks("customers", "id", customerIds);

  console.log("\n=== Cleanup complete ===");
  console.log(`Customers deleted: ${customersDeleted}`);
  console.log(`Loans deleted:     ${loansDeleted}`);
  console.log(`Payments deleted:  ${paymentsDeleted}`);
  console.log(`Documents removed: ${documentsDeleted}`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});

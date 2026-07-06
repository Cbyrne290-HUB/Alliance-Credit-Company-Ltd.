import { supabaseAdmin } from "./admin-client";
import { chunk } from "./test-data";
import { mapWithConcurrency } from "./confirm";
import { DOCUMENTS_BUCKET } from "@/lib/documents";

/** Lists and removes every stored file under each given customer id's folder. */
export async function removeDocumentsForCustomers(customerIds: string[]): Promise<number> {
  if (customerIds.length === 0) return 0;

  const perCustomerPaths = await mapWithConcurrency(customerIds, 20, async (customerId) => {
    const { data, error } = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).list(customerId);
    if (error || !data) return [] as string[];
    return data.map((f) => `${customerId}/${f.name}`);
  });

  const allPaths = perCustomerPaths.flat();
  let removed = 0;

  for (const pathBatch of chunk(allPaths, 100)) {
    const { data, error } = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove(pathBatch);
    if (error) throw new Error(`Removing storage objects failed: ${error.message}`);
    removed += data?.length ?? 0;
  }

  return removed;
}

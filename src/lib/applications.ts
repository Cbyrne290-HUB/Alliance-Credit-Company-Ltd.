import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveAgent } from "@/types/agent";
import type { Application } from "@/types/application";
import { DOCUMENTS_BUCKET, type DocumentColumn } from "@/lib/documents";
import {
  DEFAULT_INTEREST_RATE,
  computeFinalWeekPayment,
  computeLoanFinancials,
  generateLoanReference,
} from "@/lib/loans";

export const APPLICATION_DOCUMENTS_BUCKET = "application-documents";

/** Signed URLs are regenerated on every page load, so this only needs to
 * outlive a single review session. */
export const APPLICATION_SIGNED_URL_TTL_SECONDS = 600;

/**
 * Maps each application document column to the customer document column
 * it becomes once approved, and the storage slug used for the copied
 * file's new path (see documentStoragePath in lib/documents.ts).
 */
export const APPLICATION_DOCUMENT_FIELDS = [
  { column: "id_doc_url", customerColumn: "id_photo_url", slug: "id_photo", label: "ID Photo" },
  {
    column: "address_doc_url",
    customerColumn: "address_proof_url",
    slug: "address_proof",
    label: "Proof of Address",
  },
  {
    column: "income_doc_url",
    customerColumn: "income_proof_url",
    slug: "income_proof",
    label: "Proof of Income",
  },
  { column: "ppsn_doc_url", customerColumn: "ppsn_photo_url", slug: "ppsn_photo", label: "PPSN Photo" },
] as const satisfies readonly {
  column: keyof Pick<
    Application,
    "id_doc_url" | "address_doc_url" | "income_doc_url" | "ppsn_doc_url"
  >;
  customerColumn: DocumentColumn;
  slug: string;
  label: string;
}[];

export type DeclineApplicationResult =
  | { ok: true; filesDeleted: boolean; cleanupError?: string }
  | { ok: false; error: string };

const STORAGE_REMOVE_BATCH_SIZE = 100;

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Lists and removes every file under the application's storage folder
 * (proof documents and signed declaration images alike), regardless of
 * filename — so any new file type dropped under {applicationId}/ is
 * cleaned up automatically. An empty or already-cleared folder is a
 * no-op success, not an error. */
async function deleteApplicationFolder(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: files, error: listError } = await supabase.storage
    .from(APPLICATION_DOCUMENTS_BUCKET)
    .list(applicationId);

  if (listError) {
    return { ok: false, error: listError.message };
  }

  const paths = (files ?? []).map((file) => `${applicationId}/${file.name}`);
  if (paths.length === 0) {
    return { ok: true };
  }

  for (const batch of chunk(paths, STORAGE_REMOVE_BATCH_SIZE)) {
    const { error: removeError } = await supabase.storage
      .from(APPLICATION_DOCUMENTS_BUCKET)
      .remove(batch);

    if (removeError) {
      return { ok: false, error: removeError.message };
    }
  }

  return { ok: true };
}

/**
 * Keeps the application record for history — only its status changes —
 * but permanently deletes its uploaded documents and signatures from
 * storage, since a decline should not leave sensitive files behind.
 *
 * The DB status update runs first and is what actually finalizes the
 * decline: once it succeeds, the application is "declined" and locked
 * out of the approve/decline actions in the UI (see StatusBanner /
 * ApplicationDetail, gated on status === "pending") regardless of what
 * happens next. Storage cleanup is therefore treated as best-effort
 * afterwards — if it fails, the function still reports success (the
 * decline itself is real and irreversible) but flags the cleanup
 * failure so the caller can surface it instead of silently leaving
 * files behind.
 */
export async function declineApplication(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<DeclineApplicationResult> {
  const { error } = await supabase
    .from("applications")
    .update({ status: "declined" })
    .eq("id", applicationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const cleanup = await deleteApplicationFolder(supabase, applicationId);
  if (!cleanup.ok) {
    return { ok: true, filesDeleted: false, cleanupError: cleanup.error };
  }

  return { ok: true, filesDeleted: true };
}

export type ApproveApplicationParams = {
  application: Application;
  activeAgent: ActiveAgent;
  accountNumber: string;
  walkingOrder: number | null;
  startWeek: number;
};

export type ApproveApplicationResult =
  | { ok: true; customerId: string; loanId: string }
  | { ok: false; error: string; customerId?: string };

function extensionFor(path: string): string {
  const dotIndex = path.lastIndexOf(".");
  return dotIndex >= 0 ? path.slice(dotIndex + 1) : "jpg";
}

/**
 * Converts an approved application into a real customer + loan:
 *
 * 1. Create the customer record, assigned to the approver's activeAgent
 *    (whichever book they're currently viewing).
 * 2. Copy each of the four uploaded documents from the private
 *    application-documents bucket into the customer's usual documents
 *    bucket path, and link them on the new customer row.
 * 3. Create the loan (standard interest calc, reusing lib/loans.ts) plus
 *    its full payment schedule.
 * 4. Mark the application "approved" (the record itself is kept).
 *
 * Mirrors the no-rollback, best-effort error reporting used by
 * NewLoanForm: if a later step fails, earlier successful steps are left
 * in place and the error says what already exists so the caller isn't
 * tempted to retry from scratch and create a duplicate customer.
 */
export async function approveApplication(
  supabase: SupabaseClient,
  params: ApproveApplicationParams,
): Promise<ApproveApplicationResult> {
  const { application, activeAgent, accountNumber, walkingOrder, startWeek } = params;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      agent: activeAgent,
      account_number: accountNumber,
      first_name: application.first_name,
      surname: application.last_name,
      address: application.address,
      eircode: application.eircode,
      phone: application.phone,
      walking_order: walkingOrder,
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    return {
      ok: false,
      error: customerError?.message ?? "Could not create customer. Please try again.",
    };
  }

  const customerId = customer.id as string;

  const docUpdates: Partial<Record<DocumentColumn, string>> = {};

  for (const field of APPLICATION_DOCUMENT_FIELDS) {
    const sourcePath = application[field.column];
    if (!sourcePath) continue;

    const destPath = `${customerId}/${field.slug}.${extensionFor(sourcePath)}`;

    const { error: copyError } = await supabase.storage
      .from(APPLICATION_DOCUMENTS_BUCKET)
      .copy(sourcePath, destPath, { destinationBucket: DOCUMENTS_BUCKET });

    if (copyError) {
      return {
        ok: false,
        customerId,
        error: `Customer created, but could not copy ${field.label}: ${copyError.message}`,
      };
    }

    docUpdates[field.customerColumn] = destPath;
  }

  if (Object.keys(docUpdates).length > 0) {
    const { error: docUpdateError } = await supabase
      .from("customers")
      .update(docUpdates)
      .eq("id", customerId)
      .eq("agent", activeAgent);

    if (docUpdateError) {
      return {
        ok: false,
        customerId,
        error: `Customer and documents created, but could not link the documents: ${docUpdateError.message}`,
      };
    }
  }

  const { interest, totalRepayable, weeklyPayment } = computeLoanFinancials(
    application.loan_amount,
    DEFAULT_INTEREST_RATE,
    application.loan_term_weeks,
  );

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .insert({
      agent: activeAgent,
      customer_id: customerId,
      loan_reference: generateLoanReference(),
      principal: application.loan_amount,
      interest,
      total_repayable: totalRepayable,
      weekly_payment: weeklyPayment,
      term_weeks: application.loan_term_weeks,
      start_week: startWeek,
      status: "active",
      balance: totalRepayable,
      arrears: 0,
    })
    .select("id")
    .single();

  if (loanError || !loan) {
    return {
      ok: false,
      customerId,
      error: `Customer created, but could not create the loan: ${loanError?.message ?? "unknown error"}`,
    };
  }

  const loanId = loan.id as string;

  const finalWeekPayment = computeFinalWeekPayment(
    totalRepayable,
    weeklyPayment,
    application.loan_term_weeks,
  );

  const schedule = Array.from({ length: application.loan_term_weeks }, (_, i) => ({
    agent: activeAgent,
    loan_id: loanId,
    week_number: startWeek + i,
    amount_due: i === application.loan_term_weeks - 1 ? finalWeekPayment : weeklyPayment,
    status: "pending",
    flagged: false,
  }));

  const { error: scheduleError } = await supabase.from("payments").insert(schedule);

  if (scheduleError) {
    return {
      ok: false,
      customerId,
      error: `Customer and loan created, but the payment schedule failed to generate: ${scheduleError.message}`,
    };
  }

  const { error: statusError } = await supabase
    .from("applications")
    .update({ status: "approved" })
    .eq("id", application.id);

  if (statusError) {
    return {
      ok: false,
      customerId,
      error: `Customer and loan created, but could not mark the application approved: ${statusError.message}`,
    };
  }

  return { ok: true, customerId, loanId };
}

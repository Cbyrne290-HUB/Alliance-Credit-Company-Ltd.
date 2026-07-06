/**
 * Seeds load-test data: 700 customers on agent A, 1300 on agent B, each
 * with one loan and a realistic-ish payment history. Every row is tagged
 * ZZTEST_ (see scripts/lib/test-data.ts) so scripts/cleanup-test-data.ts
 * can remove exactly this data and nothing else.
 *
 * Run: npx tsx scripts/seed-test-data.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (see scripts/lib/admin-client.ts).
 */
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./lib/admin-client";
import {
  chunk,
  randomAddress,
  randomDateOfBirth,
  randomEircode,
  randomInt,
  randomIrishMobile,
  randomPpsn,
  randomName,
  shuffled,
  testAccountNumber,
  testSurname,
  uniqueLoanReference,
} from "./lib/test-data";
import {
  DEFAULT_INTEREST_RATE,
  DEFAULT_TERM_WEEKS,
  computeFinalWeekPayment,
  computeLedger,
  computeLoanFinancials,
  round2,
} from "@/lib/loans";
import { addDays, getWeekOfYear, toISODate } from "@/lib/dates";
import type { ActiveAgent } from "@/types/agent";

const AGENT_COUNTS: Record<ActiveAgent, number> = { A: 700, B: 1300 };
const INSERT_BATCH_SIZE = 500;

type HistoryProfile = "new" | "on_time" | "arrears" | "cleared";

/** Roughly: 10% brand new, 50% paying on time, 20% behind, 20% cleared. */
function randomHistoryProfile(): HistoryProfile {
  const r = Math.random();
  if (r < 0.1) return "new";
  if (r < 0.6) return "on_time";
  if (r < 0.8) return "arrears";
  return "cleared";
}

type CustomerRow = {
  id: string;
  agent: ActiveAgent;
  account_number: string;
  first_name: string;
  surname: string;
  date_of_birth: string;
  address: string;
  eircode: string;
  phone: string;
  ppsn: string;
  walking_order: number;
};

type LoanRow = {
  id: string;
  agent: ActiveAgent;
  customer_id: string;
  loan_reference: string;
  principal: number;
  interest: number;
  total_repayable: number;
  weekly_payment: number;
  term_weeks: number;
  start_week: number;
  status: string;
  balance: number;
  arrears: number;
  created_at: string;
};

type PaymentRow = {
  id: string;
  agent: ActiveAgent;
  loan_id: string;
  week_number: number;
  amount_due: number;
  amount_paid: number | null;
  balance_after: number | null;
  arrears_after: number | null;
  status: string;
  flagged: boolean;
  payment_date: string | null;
};

function buildLoanAndPayments(
  agent: ActiveAgent,
  customerId: string,
  loanCreatedAt: Date,
): { loan: LoanRow; payments: PaymentRow[] } {
  const principal = round2(randomInt(5, 30) * 100); // 500 - 3000, in 100s
  const { interest, totalRepayable, weeklyPayment } = computeLoanFinancials(
    principal,
    DEFAULT_INTEREST_RATE,
    DEFAULT_TERM_WEEKS,
  );
  const finalWeekPayment = computeFinalWeekPayment(
    totalRepayable,
    weeklyPayment,
    DEFAULT_TERM_WEEKS,
  );
  const startWeek = getWeekOfYear(loanCreatedAt).week;
  const loanId = randomUUID();

  const profile = randomHistoryProfile();
  const weeksPaidCount =
    profile === "new"
      ? 0
      : profile === "cleared"
        ? DEFAULT_TERM_WEEKS
        : randomInt(1, DEFAULT_TERM_WEEKS - 1);

  const baseSchedule = Array.from({ length: DEFAULT_TERM_WEEKS }, (_, i) => ({
    weekNumber: startWeek + i,
    amountDue: i === DEFAULT_TERM_WEEKS - 1 ? finalWeekPayment : weeklyPayment,
  }));

  // A loan with zero payments recorded matches exactly what the app itself
  // inserts on loan creation (see new-loan-form.tsx): only week_number,
  // amount_due, status "pending", flagged false — balance_after/
  // arrears_after stay null until the first payment is ever saved (that's
  // what savePaymentForRow populates). Running these through computeLedger
  // would wrongly stamp every future week with a non-null balance.
  if (weeksPaidCount === 0) {
    const payments: PaymentRow[] = baseSchedule.map((s) => ({
      id: randomUUID(),
      agent,
      loan_id: loanId,
      week_number: s.weekNumber,
      amount_due: s.amountDue,
      amount_paid: null,
      balance_after: null,
      arrears_after: null,
      status: "pending",
      flagged: false,
      payment_date: null,
    }));

    const loan: LoanRow = {
      id: loanId,
      agent,
      customer_id: customerId,
      loan_reference: uniqueLoanReference(loanCreatedAt),
      principal,
      interest,
      total_repayable: totalRepayable,
      weekly_payment: weeklyPayment,
      term_weeks: DEFAULT_TERM_WEEKS,
      start_week: startWeek,
      status: "active",
      balance: totalRepayable,
      arrears: 0,
      created_at: loanCreatedAt.toISOString(),
    };

    return { loan, payments };
  }

  const schedule = baseSchedule.map((s, i) => {
    const isPaidWeek = i < weeksPaidCount;
    let amountPaid: number | null = null;
    let paymentDate: string | null = null;

    if (isPaidWeek) {
      paymentDate = toISODate(addDays(loanCreatedAt, i * 7));
      if (profile === "arrears" && Math.random() < 0.4) {
        // Underpay this week (a shortfall that accumulates as arrears).
        amountPaid = round2(s.amountDue * (0.3 + Math.random() * 0.4));
      } else {
        amountPaid = s.amountDue;
      }
    }

    return {
      id: randomUUID(),
      week_number: s.weekNumber,
      amount_due: s.amountDue,
      amount_paid: amountPaid,
      payment_date: paymentDate,
    };
  });

  const ledger = computeLedger(
    schedule.map((s) => ({
      id: s.id,
      agent,
      loan_id: loanId,
      week_number: s.week_number,
      amount_due: s.amount_due,
      amount_paid: s.amount_paid,
      balance_after: null,
      arrears_after: null,
      status: null,
      flagged: null,
      payment_date: s.payment_date,
      notes: null,
      created_at: null,
    })),
    totalRepayable,
    weeklyPayment,
  );

  const payments: PaymentRow[] = ledger.rows.map((row) => ({
    id: row.id,
    agent,
    loan_id: loanId,
    week_number: row.week_number,
    amount_due: row.amount_due,
    amount_paid: row.amount_paid,
    balance_after: row.balance_after,
    arrears_after: row.arrears_after,
    status: row.status ?? "pending",
    flagged: Boolean(row.flagged),
    payment_date: row.payment_date,
  }));

  const loan: LoanRow = {
    id: loanId,
    agent,
    customer_id: customerId,
    loan_reference: uniqueLoanReference(loanCreatedAt),
    principal,
    interest,
    total_repayable: totalRepayable,
    weekly_payment: weeklyPayment,
    term_weeks: DEFAULT_TERM_WEEKS,
    start_week: startWeek,
    status: ledger.status,
    balance: ledger.balance,
    arrears: ledger.arrears,
    created_at: loanCreatedAt.toISOString(),
  };

  return { loan, payments };
}

async function insertInBatches<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = INSERT_BATCH_SIZE,
) {
  const batches = chunk(rows, batchSize);
  let inserted = 0;

  for (const [i, batch] of batches.entries()) {
    // supabaseAdmin has no generated Database schema type wired in, so
    // .insert() can't verify a dynamic table name's row shape at the type
    // level — the batch objects themselves are still fully typed above.
    const { error } = await supabaseAdmin.from(table).insert(batch as never);
    if (error) {
      throw new Error(
        `Insert into ${table} failed on batch ${i + 1}/${batches.length}: ${error.message}`,
      );
    }
    inserted += batch.length;
    console.log(`  ${table}: ${inserted}/${rows.length}`);
  }
}

async function main() {
  console.log("Generating test data in memory...");

  const now = new Date();
  let accountIndex = 1;

  const allCustomers: CustomerRow[] = [];
  const allLoans: LoanRow[] = [];
  const allPayments: PaymentRow[] = [];

  const summary = {
    A: { customers: 0, loans: 0, payments: 0, cleared: 0, arrears: 0 },
    B: { customers: 0, loans: 0, payments: 0, cleared: 0, arrears: 0 },
  };

  for (const agent of ["A", "B"] as ActiveAgent[]) {
    const count = AGENT_COUNTS[agent];
    const walkingOrders = shuffled(Array.from({ length: count }, (_, i) => i + 1));

    for (let i = 0; i < count; i++) {
      const { firstName, realSurname } = randomName();
      const customerId = randomUUID();

      allCustomers.push({
        id: customerId,
        agent,
        account_number: testAccountNumber(accountIndex),
        first_name: firstName,
        surname: testSurname(realSurname),
        date_of_birth: randomDateOfBirth(),
        address: randomAddress(),
        eircode: randomEircode(),
        phone: randomIrishMobile(),
        ppsn: randomPpsn(),
        walking_order: walkingOrders[i],
      });
      accountIndex += 1;

      // Spread loan creation dates over the last ~5 months so the
      // Dashboard's monthly trend chart has something to show.
      const loanCreatedAt = addDays(now, -randomInt(0, 150));
      const { loan, payments } = buildLoanAndPayments(agent, customerId, loanCreatedAt);

      allLoans.push(loan);
      allPayments.push(...payments);

      summary[agent].customers += 1;
      summary[agent].loans += 1;
      summary[agent].payments += payments.filter((p) => p.amount_paid !== null).length;
      if (loan.status === "cleared") summary[agent].cleared += 1;
      if (loan.arrears > 0) summary[agent].arrears += 1;
    }
  }

  console.log(
    `Generated ${allCustomers.length} customers, ${allLoans.length} loans, ${allPayments.length} payment rows.\n`,
  );

  console.log("Inserting customers...");
  await insertInBatches("customers", allCustomers);

  console.log("Inserting loans...");
  await insertInBatches("loans", allLoans);

  console.log("Inserting payments...");
  await insertInBatches("payments", allPayments);

  console.log("\n=== Seed complete ===");
  for (const agent of ["A", "B"] as ActiveAgent[]) {
    const s = summary[agent];
    console.log(
      `Agent ${agent}: ${s.customers} customers, ${s.loans} loans (${s.cleared} cleared, ${s.arrears} in arrears), ${s.payments} recorded payments`,
    );
  }
  console.log(
    `\nAll rows tagged with account_number/surname prefix. Run scripts/cleanup-test-data.ts to remove them later.`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

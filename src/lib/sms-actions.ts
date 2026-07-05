"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { getTwilioClient, getTwilioFromNumber } from "@/lib/twilio";
import { toE164Irish } from "@/lib/phone";
import type { ActiveAgent } from "@/types/agent";
import type { Customer } from "@/types/customer";
import type { Loan } from "@/types/loan";

const ARREARS_REMINDER_MESSAGE =
  "Hi, your current loan account is now in arrears. Please call your agent immediately to arrange payment or discuss options. Prompt action will help protect your future credit.";

const CHRISTMAS_MESSAGE =
  "Hi! Just a quick message to let you know due the upcoming Christmas Holiday, your agent will be calling on Wed 22nd or Thurs 23rd. We'd like to thank you for your support throughout the year and wish you a very Merry Christmas and a Happy New Year! If you need an agent to call at an alternative time before the holidays, please get in touch as soon as possible.";

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Sends the fixed arrears reminder to a single loan's customer. Re-derives
 * the active agent and re-checks arrears/phone server-side rather than
 * trusting the client, since this triggers a billed Twilio send.
 */
export async function sendArrearsReminderAction(loanId: string): Promise<SendResult> {
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();

  const { data: loanData } = await supabase
    .from("loans")
    .select("id, customer_id, arrears")
    .eq("id", loanId)
    .eq("agent", activeAgent)
    .single();

  const loan = loanData as Pick<Loan, "id" | "customer_id" | "arrears"> | null;

  if (!loan) {
    return { ok: false, error: "Loan not found." };
  }
  if (!loan.customer_id) {
    return { ok: false, error: "This loan has no customer on file." };
  }
  if ((loan.arrears ?? 0) <= 0) {
    return { ok: false, error: "This loan is not in arrears." };
  }

  const { data: customerData } = await supabase
    .from("customers")
    .select("id, phone")
    .eq("id", loan.customer_id)
    .eq("agent", activeAgent)
    .single();

  const customer = customerData as Pick<Customer, "id" | "phone"> | null;

  if (!customer) {
    return { ok: false, error: "Customer not found." };
  }
  if (!customer.phone) {
    return { ok: false, error: "This customer has no phone number on file." };
  }

  const to = toE164Irish(customer.phone);
  if (!to) {
    return { ok: false, error: "This customer's phone number is invalid." };
  }

  try {
    const client = getTwilioClient();
    await client.messages.create({
      to,
      from: getTwilioFromNumber(),
      body: ARREARS_REMINDER_MESSAGE,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send message via Twilio.",
    };
  }
}

async function getActiveCustomersWithPhone(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
) {
  const { data: loansData } = await supabase
    .from("loans")
    .select("customer_id")
    .eq("agent", activeAgent)
    .eq("status", "active");

  const customerIds = Array.from(
    new Set(
      ((loansData ?? []) as { customer_id: string | null }[])
        .map((l) => l.customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (customerIds.length === 0) return [];

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, first_name, surname, phone")
    .in("id", customerIds)
    .eq("agent", activeAgent);

  return (
    (customersData ?? []) as Pick<
      Customer,
      "id" | "first_name" | "surname" | "phone"
    >[]
  ).filter((c): c is typeof c & { phone: string } => Boolean(c.phone));
}

export type BroadcastPreviewResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/** Fetches a fresh count for the confirmation dialog, scoped to the active agent. */
export async function getChristmasBroadcastPreviewAction(): Promise<BroadcastPreviewResult> {
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();
  const customers = await getActiveCustomersWithPhone(supabase, activeAgent);
  return { ok: true, count: customers.length };
}

export type BroadcastSendResult =
  | { ok: true; sent: number; failed: number; total: number }
  | { ok: false; error: string };

/** Sends the fixed Christmas message one by one to every active customer with a phone. */
export async function sendChristmasBroadcastAction(): Promise<BroadcastSendResult> {
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();
  const customers = await getActiveCustomersWithPhone(supabase, activeAgent);

  if (customers.length === 0) {
    return { ok: true, sent: 0, failed: 0, total: 0 };
  }

  const client = getTwilioClient();
  const from = getTwilioFromNumber();

  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    const to = toE164Irish(customer.phone);
    if (!to) {
      failed += 1;
      continue;
    }
    try {
      await client.messages.create({ to, from, body: CHRISTMAS_MESSAGE });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { ok: true, sent, failed, total: customers.length };
}

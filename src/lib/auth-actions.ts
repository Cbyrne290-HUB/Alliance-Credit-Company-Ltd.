"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AGENT_COOKIE } from "@/lib/agent-context";

/**
 * Clears the Supabase session cookies and the active_agent cookie so a
 * shared device lands on a clean login screen for the next user.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(AGENT_COOKIE);
}

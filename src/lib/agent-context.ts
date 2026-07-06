import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AgentContextValue, ActiveAgent } from "@/types/agent";

export const AGENT_COOKIE = "active_agent";

/**
 * Resolves who's logged in and which agent's book they're viewing.
 *
 * role comes from Supabase auth app_metadata (NOT user_metadata — the
 * latter is self-editable by the user via supabase.auth.updateUser() and
 * must never be trusted for authorization; app_metadata can only be set
 * by an admin/service-role, which is what the database's RLS policies
 * also key off, so the app and the DB agree on the same trusted source)
 * and is the only source of truth for permissions: agent_a accounts are
 * hard-locked to activeAgent "A" here regardless of what the active_agent
 * cookie says, so a tampered cookie can never grant an agent_a login a
 * view into Agent B's data. agent_b accounts get their agent from the
 * cookie (defaulting to "B").
 *
 * Wrapped in React's cache() so every server component/page that calls
 * this within the same request reuses one resolution instead of each
 * re-verifying the session independently.
 */
export const getAgentContext = cache(async (): Promise<AgentContextValue> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role === "agent_b" ? "agent_b" : "agent_a";
  const canSwitch = role === "agent_b";

  if (!canSwitch) {
    return { userEmail: user?.email ?? null, role, activeAgent: "A", canSwitch };
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(AGENT_COOKIE)?.value;
  const activeAgent: ActiveAgent = cookieValue === "A" ? "A" : "B";

  return { userEmail: user?.email ?? null, role, activeAgent, canSwitch };
});

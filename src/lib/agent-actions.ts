"use server";

import { cookies } from "next/headers";
import { AGENT_COOKIE } from "@/lib/agent-context";
import type { ActiveAgent } from "@/types/agent";

/**
 * Persists the viewing agent choice for agent_b logins. This only ever
 * changes which cookie value getAgentContext() reads back for agent_b —
 * agent_a logins ignore this cookie entirely (see getAgentContext), so
 * calling this cannot grant broader access on its own.
 */
export async function setActiveAgentAction(agent: ActiveAgent) {
  const cookieStore = await cookies();
  cookieStore.set(AGENT_COOKIE, agent, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

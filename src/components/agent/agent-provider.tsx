"use client";

import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { setActiveAgentAction } from "@/lib/agent-actions";
import type { AgentContextValue, ActiveAgent } from "@/types/agent";

type AgentContextType = AgentContextValue & {
  setActiveAgent: (agent: ActiveAgent) => void;
  isSwitching: boolean;
};

const AgentReactContext = createContext<AgentContextType | null>(null);

/**
 * value is re-supplied by the (dashboard) layout server component on every
 * render, so it's spread straight into context rather than copied into
 * local state — after setActiveAgent triggers router.refresh(), the layout
 * re-resolves getAgentContext() and this component picks up the new value
 * automatically instead of holding a stale agent.
 */
export function AgentProvider({
  value,
  children,
}: {
  value: AgentContextValue;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isSwitching, startTransition] = useTransition();

  const setActiveAgent = useCallback(
    (agent: ActiveAgent) => {
      if (!value.canSwitch || agent === value.activeAgent) return;
      startTransition(async () => {
        await setActiveAgentAction(agent);
        router.refresh();
      });
    },
    [value.canSwitch, value.activeAgent, router],
  );

  return (
    <AgentReactContext.Provider value={{ ...value, setActiveAgent, isSwitching }}>
      {children}
    </AgentReactContext.Provider>
  );
}

export function useAgentContext() {
  const ctx = useContext(AgentReactContext);
  if (!ctx) {
    throw new Error("useAgentContext must be used within an AgentProvider");
  }
  return ctx;
}

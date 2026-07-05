"use client";

import { useAgentContext } from "./agent-provider";

const AGENTS = ["A", "B"] as const;

export function AgentSwitcher() {
  const { activeAgent, canSwitch, setActiveAgent, isSwitching } = useAgentContext();

  if (!canSwitch) return null;

  return (
    <div className="flex items-center gap-2.5 border-b border-amber-200 bg-amber-50 px-8 py-2 print:hidden">
      <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
        Viewing
      </span>
      <div className="inline-flex overflow-hidden rounded-md border border-amber-300">
        {AGENTS.map((agent) => (
          <button
            key={agent}
            type="button"
            onClick={() => setActiveAgent(agent)}
            disabled={isSwitching}
            className={
              activeAgent === agent
                ? "bg-amber-500 px-3 py-1 text-xs font-semibold text-white"
                : "bg-white px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed"
            }
          >
            Agent {agent}
          </button>
        ))}
      </div>
    </div>
  );
}

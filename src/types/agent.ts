export type ActiveAgent = "A" | "B";

export type AgentRole = "agent_a" | "agent_b";

export type AgentContextValue = {
  userEmail: string | null;
  role: AgentRole;
  activeAgent: ActiveAgent;
  canSwitch: boolean;
};

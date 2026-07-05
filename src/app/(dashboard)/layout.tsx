import { Sidebar } from "@/components/layout/sidebar";
import { AgentProvider } from "@/components/agent/agent-provider";
import { AgentSwitcher } from "@/components/agent/agent-switcher";
import { getAgentContext } from "@/lib/agent-context";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const agentContext = await getAgentContext();

  return (
    <AgentProvider value={agentContext}>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <AgentSwitcher />
          {children}
        </main>
      </div>
    </AgentProvider>
  );
}

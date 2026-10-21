"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard,
  Wallet,
  Scale,
  Users,
  ClipboardList,
  // Re-add these when the Reports / Users / Settings pages are built:
  // FileBarChart,
  // UserCog,
  // Settings,
  type LucideIcon,
} from "lucide-react";
import { useAgentContext } from "@/components/agent/agent-provider";
import { signOutAction } from "@/lib/auth-actions";

const NAV_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/collections", label: "Collections", icon: Wallet },
  { href: "/balancing", label: "Balancing", icon: Scale },
  { href: "/customers", label: "Customers", icon: Users },
  // Hidden until built (pages are still "coming soon" placeholders).
  // Uncomment these and their icon imports above to restore them.
  // { href: "/reports", label: "Reports", icon: FileBarChart },
  // { href: "/users", label: "Users", icon: UserCog },
  // { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(href: string, pathname: string | null) {
  if (!pathname) return false;
  if (href === "/customers") {
    return pathname.startsWith("/customers") || pathname.startsWith("/loans");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAgentContext();
  const [isSigningOut, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col bg-black print:hidden">
      <div className="flex items-center gap-2 px-6 py-6">
        {/* Inline style guarantees the exact brand gold, matching the logo,
            with no Tailwind opacity/tint utility able to dilute it. */}
        <p
          className="font-script text-3xl leading-none"
          style={{ color: "#c4a95b" }}
        >
          The Alliance Credit Company Ltd.
        </p>
        <Image
          src="/logo.png"
          alt="The Alliance Credit Company"
          width={872}
          height={952}
          priority
          className="h-11 w-auto shrink-0"
        />
      </div>

      <nav className="flex-1 space-y-2 px-3">
        {NAV_LINKS.map((link) => {
          const active = isActive(link.href, pathname);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "flex items-center gap-4 rounded-lg bg-[#c9a84c] px-4 py-3.5 text-lg font-semibold text-black shadow-sm"
                  : "flex items-center gap-4 rounded-lg px-4 py-3.5 text-lg font-medium text-slate-200 transition-colors hover:bg-[#c9a84c]/10 hover:text-[#c9a84c]"
              }
            >
              <Icon className="h-6 w-6 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-6 pt-2">
        <p className="mb-2 px-1 text-xs text-slate-500">
          Logged in as {role === "agent_b" ? "Agent B" : "Agent A"}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full rounded-lg px-3 py-2.5 text-sm font-medium text-black transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: "#c4a95b" }}
        >
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </aside>
  );
}

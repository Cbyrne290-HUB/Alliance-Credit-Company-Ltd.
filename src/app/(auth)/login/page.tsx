"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInAction } from "@/lib/auth-actions";

function formatLockMessage(secondsRemaining: number): string {
  const minutes = Math.max(1, Math.ceil(secondsRemaining / 60));
  return `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signInAction(username, password);

    if (!result.ok) {
      setError(result.locked ? formatLockMessage(result.secondsRemaining) : result.error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-[#c9a84c]/30 bg-black p-8 shadow-[0_0_40px_rgba(201,168,76,0.08)]">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/logo.png"
              alt="The Alliance Credit Company"
              width={872}
              height={952}
              priority
              className="h-16 w-auto"
            />
            {/* Inline style guarantees the exact brand gold, matching the
                logo, with no Tailwind opacity/tint utility able to dilute it. */}
            <h1
              className="font-script mt-3 text-4xl leading-tight"
              style={{ color: "#c4a95b" }}
            >
              The Alliance Credit Company Ltd.
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Sign in to the admin platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-300"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white shadow-sm placeholder:text-slate-500 focus:border-[#c9a84c] focus:outline-none focus:ring-1 focus:ring-[#c9a84c]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white shadow-sm focus:border-[#c9a84c] focus:outline-none focus:ring-1 focus:ring-[#c9a84c]"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#c9a84c] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#dbbd66] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

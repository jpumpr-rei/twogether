"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Mosaic from "@/components/brand/Mosaic";
import Wordmark from "@/components/brand/Wordmark";

const field =
  "w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base text-ink placeholder:text-gray-400 focus:border-ink focus:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/budgets");
      router.refresh();
    }
  }

  return (
    <>
      <Mosaic />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-hero bg-white p-6 text-ink">
          <Wordmark className="text-[36px]" />
          <p className="mt-2 text-mute-light">Money, in step.</p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
                placeholder="••••••••"
              />
            </label>

            {error && <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-lime py-3.5 font-display text-lg font-extrabold tracking-tight text-ink transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mute-light">
            New here?{" "}
            <Link href="/signup" className="cursor-pointer font-semibold text-ink underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

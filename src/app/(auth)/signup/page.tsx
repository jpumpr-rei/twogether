"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Mosaic from "@/components/brand/Mosaic";
import Wordmark from "@/components/brand/Wordmark";

const field =
  "w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base text-ink placeholder:text-gray-400 focus:border-ink focus:outline-none";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <>
        <Mosaic />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm rounded-hero bg-white p-6 text-center text-ink">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lime">
              <Mail size={26} aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold leading-none tracking-[-0.03em]">
              Check your email
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm text-mute-light">
              We sent a confirmation link to <strong className="text-ink">{email}</strong>. Click it to
              activate your account.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block cursor-pointer text-sm font-semibold underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Mosaic />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-hero bg-white p-6 text-ink">
          <Wordmark className="text-[36px]" />
          <p className="mt-2 text-mute-light">Create your account to get started.</p>

          <form onSubmit={handleSignup} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Your name</span>
              <input
                type="text"
                required
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
                placeholder="Alex"
              />
            </label>

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
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
                placeholder="At least 8 characters"
              />
            </label>

            {error && <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-lime py-3.5 font-display text-lg font-extrabold tracking-tight text-ink transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mute-light">
            Already have an account?{" "}
            <Link href="/login" className="cursor-pointer font-semibold text-ink underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

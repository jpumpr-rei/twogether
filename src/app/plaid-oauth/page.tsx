"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { useRouter } from "next/navigation";

export default function PlaidOAuthPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState("Completing bank connection…");

  // Fetch a fresh link token for the OAuth continuation
  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => setToken(data.link_token))
      .catch(() => setStatus("Connection failed. Please try again."));
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
      setStatus("Saving your account…");
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token,
          institution_id: metadata.institution?.institution_id ?? "",
          institution_name: metadata.institution?.name ?? "Unknown",
          accounts: metadata.accounts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            subtype: a.subtype,
            mask: a.mask,
          })),
        }),
      });
      router.push("/settings");
    },
    [router]
  );

  const { open, ready } = usePlaidLink({
    token,
    // Pass the full redirect URI so Plaid knows this is an OAuth continuation
    receivedRedirectUri:
      typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess,
    onExit: () => router.push("/settings"),
  });

  useEffect(() => {
    if (ready && token) open();
  }, [ready, token, open]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
      <span className="text-4xl">🏦</span>
      <p className="text-gray-500 text-sm">{status}</p>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { useRouter } from "next/navigation";

export default function PlaidConnectButton() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
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
      router.refresh();
    },
    [router]
  );

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit: () => setToken(null),
  });

  // Auto-open Plaid Link once the token is loaded and Plaid is ready
  useEffect(() => {
    if (ready && token) open();
  }, [ready, token, open]);

  async function handleClick() {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start bank connection");
      const data = await res.json();
      setToken(data.link_token);
    } catch {
      setError("Couldn't connect. Please try again.");
      setFetching(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={fetching || (token !== null && !ready)}
        className="w-full bg-orange-500 text-white text-sm font-semibold rounded-xl py-2.5 active:bg-orange-600 disabled:opacity-50"
      >
        {fetching ? "Connecting…" : "Connect a bank account"}
      </button>
      {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
    </div>
  );
}

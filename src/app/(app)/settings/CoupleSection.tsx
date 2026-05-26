"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHousehold, joinHousehold, sendInviteEmail } from "./coupleActions";

type Partner = { display_name: string | null; email: string } | null;
type Couple = { name: string | null; invite_code: string } | null;

export default function CoupleSection({
  couple,
  partner,
}: {
  couple: Couple;
  partner: Partner;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  // ── Already linked ────────────────────────────────────────────────────────
  if (couple && partner) {
    return (
      <div className="px-4 py-4 space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-lg flex-shrink-0">
            🤝
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {partner.display_name ?? "Your partner"}
            </p>
            <p className="text-xs text-gray-400">{partner.email}</p>
          </div>
          <span className="ml-auto text-xs font-semibold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
            Linked ✓
          </span>
        </div>
      </div>
    );
  }

  // ── Has household, waiting for partner ────────────────────────────────────
  if (couple) {
    return (
      <InviteCodeView
        inviteCode={couple.invite_code}
        onRefresh={refresh}
      />
    );
  }

  // ── No household yet ──────────────────────────────────────────────────────
  return <SetupView onCreated={refresh} />;
}

// ── No household: create or join ──────────────────────────────────────────────
function SetupView({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    const res = await createHousehold();
    if (res.error) { setError(res.error); setLoading(false); }
    else onCreated();
  }

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const res = await joinHousehold(code);
    if (res.error) { setError(res.error); setLoading(false); }
    else onCreated();
  }

  if (mode === "join") {
    return (
      <div className="px-4 py-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-1">Enter invite code</p>
          <p className="text-xs text-gray-400">Ask your partner for their code from Settings → Household.</p>
        </div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          maxLength={12}
          autoFocus
          autoCapitalize="characters"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 uppercase"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => { setMode("idle"); setError(null); setCode(""); }}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl py-2.5 hover:bg-gray-50 active:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={loading || !code.trim()}
            className="flex-1 bg-orange-500 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-orange-600 active:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Joining…" : "Join"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-sm text-gray-500">
        Create a household to share budgets and track spending together, or join your partner&apos;s existing household.
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="flex-1 bg-orange-500 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-orange-600 active:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create household"}
        </button>
        <button
          onClick={() => setMode("join")}
          disabled={loading}
          className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl py-2.5 hover:bg-gray-50 active:bg-gray-50 disabled:opacity-50"
        >
          Enter code
        </button>
      </div>
    </div>
  );
}

// ── Has household, waiting for partner ────────────────────────────────────────
function InviteCodeView({
  inviteCode,
  onRefresh,
}: {
  inviteCode: string;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  }

  async function handleSendInvite() {
    if (!email.trim()) return;
    setSending(true);
    setSendError(null);
    setSent(false);
    const res = await sendInviteEmail(email.trim());
    setSending(false);
    if (res.error) {
      setSendError(res.error);
    } else {
      setSent(true);
      setEmail("");
      setTimeout(() => setSent(false), 5000);
    }
  }

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const res = await joinHousehold(code);
    if (res.error) { setError(res.error); setLoading(false); }
    else onRefresh();
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Invite code display */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Your invite code
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-center">
            <span className="font-mono font-bold text-2xl tracking-[0.25em] text-orange-500">
              {inviteCode}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className={`px-3 py-3 rounded-xl text-sm font-semibold flex-shrink-0 transition-colors ${
              copied
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-200"
            }`}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Email invite */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Invite by email
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSendError(null); setSent(false); }}
            placeholder="partner@email.com"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
          />
          <button
            onClick={handleSendInvite}
            disabled={sending || !email.trim()}
            className="px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 active:bg-orange-600 disabled:opacity-40 flex-shrink-0 min-w-[64px]"
          >
            {sending ? "…" : sent ? "✓ Sent" : "Send"}
          </button>
        </div>
        {sent && (
          <p className="text-xs text-green-600 font-medium">
            Invite sent! They&apos;ll get an email with a link to create their account.
          </p>
        )}
        {sendError && <p className="text-xs text-red-500">{sendError}</p>}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100" />
        <p className="text-xs text-gray-400 font-medium">or</p>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      {/* Join instead */}
      {showJoin ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Enter your partner&apos;s code</p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            maxLength={12}
            autoFocus
            autoCapitalize="characters"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 uppercase"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJoin(false); setCode(""); setError(null); }}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl py-2.5 hover:bg-gray-50 active:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleJoin}
              disabled={loading || !code.trim()}
              className="flex-1 bg-orange-500 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-orange-600 active:bg-orange-600 disabled:opacity-50"
            >
              {loading ? "Joining…" : "Join"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowJoin(true)}
          className="w-full text-center text-sm text-orange-500 font-medium py-1 hover:opacity-75 active:opacity-60"
        >
          Enter your partner&apos;s code instead →
        </button>
      )}
    </div>
  );
}

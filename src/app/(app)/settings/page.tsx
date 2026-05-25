import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/ui/SignOutButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  type CoupleRow = { name: string | null; invite_code: string };
  let couple: CoupleRow | null = null;
  if (profile?.couple_id) {
    const { data } = await supabase
      .from("couples")
      .select("name, invite_code")
      .eq("id", profile.couple_id)
      .single();
    couple = data as CoupleRow | null;
  }

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <Section title="Profile">
        <Row label="Name" value={profile?.display_name ?? "—"} />
        <Row label="Email" value={user.email ?? "—"} />
      </Section>

      {/* Couple */}
      <Section title="Your couple">
        {couple ? (
          <>
            <Row label="Couple name" value={couple.name ?? "Unnamed couple"} />
            <Row label="Invite code" value={couple.invite_code} mono />
          </>
        ) : (
          <div className="px-4 py-4 text-sm text-gray-500 space-y-3">
            <p>You haven&apos;t linked with a partner yet.</p>
            <div className="flex gap-2">
              <button className="flex-1 bg-orange-500 text-white text-sm font-semibold rounded-xl py-2.5 active:bg-orange-600">
                Create invite
              </button>
              <button className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl py-2.5 active:bg-gray-50">
                Enter code
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Connected cards */}
      <Section title="Connected cards">
        <div className="px-4 py-4 text-sm text-gray-500 space-y-3">
          <p>No cards connected yet.</p>
          <button className="w-full bg-orange-500 text-white text-sm font-semibold rounded-xl py-2.5 active:bg-orange-600">
            Connect a bank account
          </button>
        </div>
      </Section>

      <SignOutButton />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
        {title}
      </p>
      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

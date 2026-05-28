import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/ui/SignOutButton";
import CoupleSection from "./CoupleSection";
import EditNameRow from "./EditNameRow";
import CategoriesSection from "./CategoriesSection";
import type { CategoryRow } from "./CategoriesSection";

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
  type PartnerRow = { display_name: string | null; email: string } | null;
  let partner: PartnerRow = null;

  let customCategories: CategoryRow[] = [];
  if (profile?.couple_id) {
    const [{ data: coupleData }, { data: partnerData }] = await Promise.all([
      supabase
        .from("couples")
        .select("name, invite_code")
        .eq("id", profile.couple_id)
        .single(),
      supabase
        .from("profiles")
        .select("display_name, email")
        .eq("couple_id", profile.couple_id)
        .neq("id", user.id)
        .maybeSingle(),
    ]);
    couple = coupleData as CoupleRow | null;
    partner = partnerData as PartnerRow;

    const { data: catData } = await supabase
      .from("categories")
      .select("id, name, icon, color")
      .eq("couple_id", profile.couple_id)
      .order("name");
    customCategories = (catData ?? []) as CategoryRow[];
  }

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <Section title="Profile">
        <EditNameRow initialName={profile?.display_name ?? null} />
        <Row label="Email" value={user.email ?? "—"} />
      </Section>

      {/* Household / Partner */}
      <Section title="Household">
        <CoupleSection couple={couple} partner={partner} />
      </Section>

      {/* Custom Categories */}
      <Section title="Custom Categories">
        <CategoriesSection categories={customCategories} />
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

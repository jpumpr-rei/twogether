import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export type TxPoint = {
  amount: number;
  date: string;
  category_id: string | null;
};

export type CategoryInfo = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type RecentTx = {
  id: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category_id: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const name = (profile?.display_name ?? user.email?.split("@")[0] ?? "there").split(" ")[0];
  const coupleId = profile?.couple_id ?? null;

  if (!coupleId) {
    return (
      <div className="px-4 pt-12 pb-24 space-y-6">
        <div>
          <p className="text-gray-500 text-sm">Good to see you,</p>
          <h1 className="text-2xl font-bold text-gray-900">{name} 👋</h1>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 text-center space-y-3">
          <p className="text-3xl">💑</p>
          <p className="font-semibold text-gray-800">Connect with your partner</p>
          <p className="text-sm text-gray-500">
            Share an invite code to link accounts and start tracking budgets together.
          </p>
        </div>
      </div>
    );
  }

  // 13 months of data for trend chart (current + 12 past)
  const chartStart = new Date();
  chartStart.setDate(1);
  chartStart.setMonth(chartStart.getMonth() - 12);
  const startDate = chartStart.toISOString().split("T")[0];

  const [{ data: txData }, { data: catData }, { data: recentData }] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, date, category_id")
      .eq("couple_id", coupleId)
      .gte("date", startDate),
    supabase
      .from("categories")
      .select("id, name, icon, color")
      .or(`is_default.eq.true,couple_id.eq.${coupleId}`)
      .order("name"),
    supabase
      .from("transactions")
      .select("id, merchant_name, amount, date, category_id")
      .eq("couple_id", coupleId)
      .order("date", { ascending: false })
      .limit(5),
  ]);

  return (
    <DashboardClient
      name={name}
      transactions={(txData ?? []) as TxPoint[]}
      categories={(catData ?? []) as CategoryInfo[]}
      recentTransactions={(recentData ?? []) as RecentTx[]}
    />
  );
}

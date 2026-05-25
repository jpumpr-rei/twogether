import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
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

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "there";

  type TxRow = {
    id: string;
    merchant_name: string | null;
    amount: number;
    date: string;
    category_id: string | null;
  };

  let transactions: TxRow[] = [];
  if (profile?.couple_id) {
    const { data } = await supabase
      .from("transactions")
      .select("id, merchant_name, amount, date, category_id")
      .eq("couple_id", profile.couple_id)
      .order("date", { ascending: false })
      .limit(5);
    transactions = (data ?? []) as TxRow[];
  }

  return (
    <div className="px-4 pt-12 space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-gray-500 text-sm">Good to see you,</p>
        <h1 className="text-2xl font-bold text-gray-900 capitalize">{name} 👋</h1>
      </div>

      {/* No couple yet */}
      {!profile?.couple_id && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-center space-y-3">
          <p className="text-2xl">💑</p>
          <p className="font-semibold text-gray-800">Connect with your partner</p>
          <p className="text-sm text-gray-500">
            Share an invite code to link accounts and start tracking budgets together.
          </p>
          <button className="bg-orange-500 text-white text-sm font-semibold rounded-xl px-5 py-2.5 active:bg-orange-600">
            Create invite
          </button>
        </div>
      )}

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Recent activity</h2>
          <div className="bg-white rounded-2xl divide-y divide-gray-50 shadow-sm">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl">📦</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {tx.merchant_name ?? "Unknown merchant"}
                  </p>
                  <p className="text-xs text-gray-400">{tx.date}</p>
                </div>
                <span className="font-semibold text-gray-800">
                  ${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transactions.length === 0 && profile?.couple_id && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <p className="text-3xl mb-2">🎉</p>
          No transactions yet — connect a card to get started.
        </div>
      )}
    </div>
  );
}

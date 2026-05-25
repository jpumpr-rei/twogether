import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type TxRow = {
  id: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  is_pending: boolean;
  category_id: string | null;
};

export default async function TransactionsPage() {
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

  let transactions: TxRow[] = [];
  if (profile?.couple_id) {
    const { data } = await supabase
      .from("transactions")
      .select("id, merchant_name, amount, date, is_pending, category_id")
      .eq("couple_id", profile.couple_id)
      .order("date", { ascending: false })
      .limit(50);
    transactions = (data ?? []) as TxRow[];
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Transactions</h1>

      {transactions.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm space-y-2">
          <p className="text-4xl">💳</p>
          <p>No transactions yet.</p>
          <p>Connect a bank card in Settings to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl divide-y divide-gray-50 shadow-sm">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                📦
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {tx.merchant_name ?? "Unknown merchant"}
                </p>
                <p className="text-xs text-gray-400">
                  {tx.date}
                  {tx.is_pending && (
                    <span className="ml-1 text-orange-400">· Pending</span>
                  )}
                </p>
              </div>
              <span
                className={`font-semibold tabular-nums ${
                  tx.amount < 0 ? "text-green-500" : "text-gray-800"
                }`}
              >
                {tx.amount < 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

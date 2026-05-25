import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type BudgetRow = {
  id: string;
  name: string;
  amount: number;
  period: string;
  category_id: string | null;
};

export default async function BudgetsPage() {
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

  let budgets: BudgetRow[] = [];
  if (profile?.couple_id) {
    const { data } = await supabase
      .from("budgets")
      .select("id, name, amount, period, category_id")
      .eq("couple_id", profile.couple_id)
      .order("created_at", { ascending: true });
    budgets = (data ?? []) as BudgetRow[];
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <button className="bg-orange-500 text-white text-sm font-semibold rounded-xl px-4 py-2 active:bg-orange-600">
          + Add
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm space-y-2">
          <p className="text-4xl">📊</p>
          <p>No budgets set up yet.</p>
          <p>
            Tap <strong>+ Add</strong> to create your first shared budget.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <div key={budget.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                  📦
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{budget.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{budget.period}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="font-bold text-gray-900">${budget.amount.toFixed(2)}</p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: "0%" }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                $0.00 of ${budget.amount.toFixed(2)} used
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

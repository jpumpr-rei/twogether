import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { plaidClient } from "@/lib/plaid/client";
import Link from "next/link";

type CardRow = {
  id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
  plaid_item_id: string | null;
  plaid_account_id: string | null;
  plaid_access_token: string | null;
  balance_available: number | null;
  balance_current: number | null;
};

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  const coupleId = profile?.couple_id ?? null;

  let cards: CardRow[] = [];

  if (coupleId) {
    const { data } = await supabase
      .from("cards")
      .select(
        "id, institution_name, account_name, last_four, account_type, plaid_item_id, plaid_account_id, plaid_access_token"
      )
      .eq("couple_id", coupleId)
      .eq("is_active", true)
      .order("institution_name");

    const rawCards = (data ?? []) as Omit<CardRow, "balance_available" | "balance_current">[];

    // Fetch live balances from Plaid — one call per unique item
    const balanceMap = new Map<string, { available: number | null; current: number | null }>();
    const seenItems = new Set<string>();

    for (const card of rawCards) {
      if (!card.plaid_access_token || !card.plaid_item_id) continue;
      if (seenItems.has(card.plaid_item_id)) continue;
      seenItems.add(card.plaid_item_id);
      try {
        const res = await plaidClient.accountsGet({ access_token: card.plaid_access_token });
        for (const acct of res.data.accounts) {
          balanceMap.set(acct.account_id, {
            available: acct.balances.available,
            current: acct.balances.current,
          });
        }
      } catch {
        // Token invalid or Plaid error — show card without balance
      }
    }

    cards = rawCards.map((card) => {
      const bal = card.plaid_account_id ? balanceMap.get(card.plaid_account_id) : undefined;
      return {
        ...card,
        balance_available: bal?.available ?? null,
        balance_current: bal?.current ?? null,
      };
    });
  }

  const Empty = () => (
    <div className="text-center py-20 text-gray-400 text-sm space-y-2">
      <p className="text-4xl">🏦</p>
      <p>No accounts connected yet.</p>
      <p>Go to Settings to link a bank account.</p>
    </div>
  );

  // Group by institution
  const institutions = new Map<string, CardRow[]>();
  for (const card of cards) {
    const arr = institutions.get(card.institution_name) ?? [];
    arr.push(card);
    institutions.set(card.institution_name, arr);
  }

  return (
    <div className="px-4 pt-12 pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Accounts</h1>

      {cards.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-5">
          {Array.from(institutions.entries()).map(([institution, accts]) => (
            <div key={institution}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {institution}
              </p>
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                {accts.map((card) => {
                  const isCredit = card.account_type === "credit";
                  const displayBalance = isCredit
                    ? card.balance_current
                    : card.balance_available;
                  return (
                    <Link
                      key={card.id}
                      href={`/accounts/${card.id}`}
                      className="flex items-center gap-3 px-4 py-4 active:bg-gray-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                        💳
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{card.account_name}</p>
                        <p className="text-xs text-gray-400 capitalize">
                          {card.account_type}
                          {card.last_four && ` ·· ${card.last_four}`}
                        </p>
                      </div>
                      <div className="text-right mr-1">
                        {displayBalance !== null ? (
                          <>
                            <p
                              className={`font-bold text-base tabular-nums ${
                                isCredit ? "text-red-500" : "text-gray-900"
                              }`}
                            >
                              $
                              {displayBalance.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-xs text-gray-400">
                              {isCredit ? "balance owed" : "available"}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                      </div>
                      <span className="text-gray-300 text-sm">›</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

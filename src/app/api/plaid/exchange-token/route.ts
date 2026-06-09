import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid/client";
import { bestCategory } from "@/lib/plaid/categorize";

type PlaidAccount = {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { public_token, institution_name, institution_id, accounts } =
    await request.json() as {
      public_token: string;
      institution_name: string;
      institution_id: string;
      accounts: PlaidAccount[];
    };

  void institution_id; // stored on cards via institution_name for now

  // Get or create couple_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  let coupleId: string = profile?.couple_id ?? "";
  if (!coupleId) {
    const { data } = await supabase.rpc("create_couple_for_user");
    coupleId = (data as string | null) ?? "";
  }
  if (!coupleId) return NextResponse.json({ error: "No household found" }, { status: 400 });

  // Exchange public token for access token
  const tokenResponse = await plaidClient.itemPublicTokenExchange({ public_token });
  const accessToken = tokenResponse.data.access_token;
  const itemId = tokenResponse.data.item_id;

  // Upsert each account as a card row
  for (const account of accounts) {
    await supabase.from("cards").upsert(
      {
        couple_id: coupleId,
        owner_id: user.id,
        plaid_item_id: itemId,
        plaid_account_id: account.id,
        plaid_access_token: accessToken,
        institution_name,
        account_name: account.name,
        last_four: account.mask ?? null,
        account_type: account.subtype ?? account.type,
        is_active: true,
      },
      { onConflict: "plaid_account_id" }
    );
  }

  // Sync the last 30 days of transactions (best-effort — don't fail the connection)
  try {
    await syncRecentTransactions(supabase, coupleId, accessToken, itemId);
  } catch (err) {
    console.error("Transaction sync failed (non-fatal):", err);
  }

  return NextResponse.json({ success: true });
}

async function syncRecentTransactions(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  coupleId: string,
  accessToken: string,
  itemId: string
) {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Fetch our categories for mapping
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name");

  const categoryMap = new Map<string, string>();
  for (const cat of categories ?? []) {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
  }

  // Map account_id → card DB id
  const { data: cards } = await supabase
    .from("cards")
    .select("id, plaid_account_id")
    .eq("couple_id", coupleId)
    .eq("plaid_item_id", itemId);

  const accountToCard = new Map<string, string>();
  for (const card of cards ?? []) {
    if (card.plaid_account_id) accountToCard.set(card.plaid_account_id, card.id);
  }

  // Fetch transactions using the get endpoint (30-day window, simpler than sync)
  const txResponse = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
    options: { count: 500, offset: 0 },
  });

  const txs = txResponse.data.transactions;

  for (const tx of txs) {
    const cardId = accountToCard.get(tx.account_id) ?? null;

    const plaidPrimary = tx.personal_finance_category?.primary ?? "";
    const isTransferByCategory = ["LOAN_PAYMENTS", "TRANSFER_IN", "TRANSFER_OUT"].includes(plaidPrimary);

    const categoryId = isTransferByCategory
      ? null
      : bestCategory(
          { merchant_name: tx.merchant_name ?? tx.name, personal_finance_category: tx.personal_finance_category },
          categoryMap
        );

    const isTransferByName =
      !isTransferByCategory &&
      !categoryId &&
      /\bpayment\b/i.test(tx.merchant_name ?? tx.name ?? "");

    const isTransfer = isTransferByCategory || isTransferByName;

    await supabase.from("transactions").upsert(
      {
        couple_id: coupleId,
        card_id: cardId,
        plaid_transaction_id: tx.transaction_id,
        merchant_name: tx.merchant_name ?? tx.name,
        amount: tx.amount, // positive = money out (Plaid convention)
        currency: tx.iso_currency_code ?? "USD",
        date: tx.date,
        is_pending: tx.pending,
        is_transfer: isTransfer,
        category_id: categoryId,
      },
      { onConflict: "plaid_transaction_id" }
    );
  }
}


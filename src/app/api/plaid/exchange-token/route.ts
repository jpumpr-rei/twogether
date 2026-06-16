import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid/client";
import { syncCouple } from "@/lib/plaid/syncCouple";

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

  // Initial transaction sync (best-effort — don't fail the connection).
  // syncCouple uses transactionsSync with no cursor on first call, fetching
  // ~24 months of history and storing the cursor for future incremental syncs.
  try {
    await syncCouple(supabase, coupleId);
  } catch (err) {
    console.error("Transaction sync failed (non-fatal):", err);
  }

  return NextResponse.json({ success: true });
}


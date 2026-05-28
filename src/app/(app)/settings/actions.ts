"use server";

import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid/client";
import { revalidatePath } from "next/cache";

export async function removeCard(cardId: string) {
  const supabase = await createClient();

  const { data: card } = await supabase
    .from("cards")
    .select("plaid_access_token, plaid_item_id, couple_id")
    .eq("id", cardId)
    .single();

  if (!card) return;

  // Only revoke the Plaid item if this is the last account linked to it
  if (card.plaid_item_id) {
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("plaid_item_id", card.plaid_item_id);

    if (count === 1 && card.plaid_access_token) {
      try {
        await plaidClient.itemRemove({ access_token: card.plaid_access_token });
      } catch {
        // Continue even if Plaid revocation fails
      }
    }
  }

  // Delete the card's transactions, then the card itself
  const { error: txError } = await supabase.from("transactions").delete().eq("card_id", cardId);
  if (txError) throw new Error(`Failed to delete transactions: ${txError.message}`);

  const { error: cardError } = await supabase.from("cards").delete().eq("id", cardId);
  if (cardError) throw new Error(`Failed to delete card: ${cardError.message}`);

  revalidatePath("/settings");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}


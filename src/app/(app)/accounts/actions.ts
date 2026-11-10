"use server";

import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid/client";
import { revalidatePath } from "next/cache";

export async function updateAccountSettings(
  cardId: string,
  { name, isPrivate }: { name: string; isPrivate?: boolean }
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");
  if (trimmed.length > 100) throw new Error("Name must be 100 characters or fewer");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Scope update to the user's own couple — prevents cross-couple mutations
  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();
  if (!profile?.couple_id) throw new Error("No household");

  // Anyone in the household can rename a joint account, but only the account holder
  // (the person who linked the bank) can change who it is hidden from. The database
  // enforces the same rule (migration_account_holder_privacy.sql); checking here gives
  // a clear error instead of a generic failure.
  const { data: card } = await supabase
    .from("cards")
    .select("owner_id, is_private")
    .eq("id", cardId)
    .eq("couple_id", profile.couple_id) // ownership check
    .single();
  if (!card) throw new Error("Account not found");

  const update: { account_name: string; is_private?: boolean } = { account_name: trimmed };
  if (isPrivate !== undefined && isPrivate !== card.is_private) {
    if (card.owner_id !== user.id) {
      throw new Error("Only the account holder can change who sees this account");
    }
    update.is_private = isPrivate;
  }

  const { error } = await supabase
    .from("cards")
    .update(update)
    .eq("id", cardId)
    .eq("couple_id", profile.couple_id); // ownership check
  if (error) throw new Error("Failed to update account settings");

  revalidatePath("/accounts");
}

export async function removeCard(cardId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();
  if (!profile?.couple_id) throw new Error("No household");

  const { data: card } = await supabase
    .from("cards")
    .select("plaid_access_token, plaid_item_id, couple_id")
    .eq("id", cardId)
    .eq("couple_id", profile.couple_id) // ownership check
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

  const { error: txError } = await supabase
    .from("transactions")
    .delete()
    .eq("card_id", cardId);
  if (txError) throw new Error("Failed to delete transactions");

  const { error: cardError } = await supabase.from("cards").delete().eq("id", cardId);
  if (cardError) throw new Error("Failed to delete account");

  revalidatePath("/accounts");
  revalidatePath("/settings");
  revalidatePath("/transactions");
}

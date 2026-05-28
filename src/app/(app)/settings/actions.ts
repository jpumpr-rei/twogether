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

export async function deleteCategory(categoryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  if (!profile?.couple_id) throw new Error("No household");

  // Confirm the category is owned by this couple (not a built-in default)
  const { data: cat } = await supabase
    .from("categories")
    .select("id, is_default, couple_id")
    .eq("id", categoryId)
    .single();

  if (!cat) throw new Error("Category not found");
  if (cat.is_default) throw new Error("Cannot delete built-in categories");
  if (cat.couple_id !== profile.couple_id) throw new Error("Unauthorized");

  // Explicitly remove the budget for this category so it doesn't orphan
  // (FK on budgets.category_id is SET NULL, not CASCADE)
  await supabase
    .from("budgets")
    .delete()
    .eq("category_id", categoryId)
    .eq("couple_id", profile.couple_id);

  // Delete the category itself; transactions FK is SET NULL so they become
  // uncategorized rather than being lost
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/budgets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

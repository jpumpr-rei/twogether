"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recategorize(
  transactionId: string,
  newCategoryId: string | null,
  applyToAll: boolean,
  merchantName: string | null
) {
  const supabase = await createClient();

  // Look up the couple_id server-side for security
  const { data: tx } = await supabase
    .from("transactions")
    .select("couple_id")
    .eq("id", transactionId)
    .single();
  if (!tx) throw new Error("Transaction not found");

  if (applyToAll && merchantName) {
    // Find all transactions for this merchant in this couple
    const { data: allTxs } = await supabase
      .from("transactions")
      .select("id")
      .eq("couple_id", tx.couple_id)
      .eq("merchant_name", merchantName);

    const ids = (allTxs ?? []).map((t) => t.id);

    // Clear any existing splits for those transactions
    if (ids.length > 0) {
      await supabase.from("transaction_splits").delete().in("transaction_id", ids);
    }

    // Bulk-update category
    const { error } = await supabase
      .from("transactions")
      .update({ category_id: newCategoryId })
      .eq("couple_id", tx.couple_id)
      .eq("merchant_name", merchantName);
    if (error) throw error;
  } else {
    // Single transaction
    await supabase
      .from("transaction_splits")
      .delete()
      .eq("transaction_id", transactionId);

    const { error } = await supabase
      .from("transactions")
      .update({ category_id: newCategoryId })
      .eq("id", transactionId);
    if (error) throw error;
  }

  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

export async function assignCategory(
  transactionId: string,
  categoryId: string | null
) {
  const supabase = await createClient();
  // Remove any existing splits (reverting to single-category)
  await supabase
    .from("transaction_splits")
    .delete()
    .eq("transaction_id", transactionId);
  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("id", transactionId);
  if (error) throw error;
  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

export async function saveSplits(
  transactionId: string,
  splits: { category_id: string | null; amount: number }[]
) {
  const supabase = await createClient();
  await supabase
    .from("transaction_splits")
    .delete()
    .eq("transaction_id", transactionId);
  const { error } = await supabase.from("transaction_splits").insert(
    splits.map((s) => ({
      transaction_id: transactionId,
      category_id: s.category_id,
      amount: s.amount,
    }))
  );
  if (error) throw error;
  // Clear direct category so budget queries don't double-count
  await supabase
    .from("transactions")
    .update({ category_id: null })
    .eq("id", transactionId);
  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

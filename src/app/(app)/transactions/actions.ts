"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

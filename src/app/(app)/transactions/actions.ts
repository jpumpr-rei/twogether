"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Shared helper — resolves the authenticated user's couple_id and verifies
// the given transaction belongs to it. Returns couple_id on success.
async function getVerifiedCoupleId(transactionId: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: tx } = await supabase
    .from("transactions")
    .select("couple_id")
    .eq("id", transactionId)
    .single();
  if (!tx) throw new Error("Transaction not found");

  return tx.couple_id;
}

export async function recategorize(
  transactionId: string,
  newCategoryId: string | null,
  applyToAll: boolean,
  merchantName: string | null
) {
  const supabase = await createClient();
  const coupleId = await getVerifiedCoupleId(transactionId);

  if (applyToAll && merchantName) {
    const { data: allTxs } = await supabase
      .from("transactions")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("merchant_name", merchantName);

    const ids = (allTxs ?? []).map((t) => t.id);

    if (ids.length > 0) {
      await supabase.from("transaction_splits").delete().in("transaction_id", ids);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("transactions")
      .update({ category_id: newCategoryId, category_manually_set: true })
      .eq("couple_id", coupleId)
      .eq("merchant_name", merchantName);
    if (error) throw error;
  } else {
    await supabase
      .from("transaction_splits")
      .delete()
      .eq("transaction_id", transactionId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("transactions")
      .update({ category_id: newCategoryId, category_manually_set: true })
      .eq("id", transactionId)
      .eq("couple_id", coupleId); // ownership check
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
  const coupleId = await getVerifiedCoupleId(transactionId);

  await supabase
    .from("transaction_splits")
    .delete()
    .eq("transaction_id", transactionId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("transactions")
    .update({ category_id: categoryId, category_manually_set: true })
    .eq("id", transactionId)
    .eq("couple_id", coupleId); // ownership check
  if (error) throw error;

  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

export async function bulkRecategorize(
  transactionIds: string[],
  categoryId: string | null
) {
  if (!transactionIds.length) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();
  if (!profile?.couple_id) throw new Error("No household");

  const coupleId = profile.couple_id;

  // Clear splits for all selected transactions
  await supabase
    .from("transaction_splits")
    .delete()
    .in("transaction_id", transactionIds);

  // Bulk update — filter by couple_id for security
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("transactions")
    .update({ category_id: categoryId, category_manually_set: true })
    .in("id", transactionIds)
    .eq("couple_id", coupleId);

  if (error) throw error;

  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

export async function markAsPayment(transactionId: string, asPayment: boolean) {
  const supabase = await createClient();
  const coupleId = await getVerifiedCoupleId(transactionId);

  await supabase.from("transaction_splits").delete().eq("transaction_id", transactionId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("transactions")
    .update(
      asPayment
        ? { is_transfer: true, category_id: null, category_manually_set: true }
        : { is_transfer: false, category_manually_set: true }
    )
    .eq("id", transactionId)
    .eq("couple_id", coupleId);

  if (error) throw error;

  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

export async function saveSplits(
  transactionId: string,
  splits: { category_id: string | null; amount: number }[]
) {
  const supabase = await createClient();
  await getVerifiedCoupleId(transactionId); // auth + ownership check

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

  // Clear direct category so budget queries don't double-count.
  // Mark as manually set so sync doesn't reassign a Plaid category.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("transactions")
    .update({ category_id: null, category_manually_set: true })
    .eq("id", transactionId);

  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

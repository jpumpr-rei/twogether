"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Returns the user's couple_id, creating a solo household via a
// SECURITY DEFINER function if none exists (bypasses RLS reliably)
async function getCoupleId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: coupleId, error } = await supabase.rpc("create_couple_for_user");
  if (error) throw new Error(`Failed to create household: ${error.message}`);
  return coupleId as string;
}

export async function setBudget(
  categoryId: string,
  name: string,
  amount: number,
  period: "weekly" | "monthly" | "yearly",
  existingId?: string
) {
  const supabase = await createClient();

  if (existingId) {
    const { error } = await supabase
      .from("budgets")
      .update({ amount, period })
      .eq("id", existingId);
    if (error) throw error;
  } else {
    const coupleId = await getCoupleId();
    const { error } = await supabase.from("budgets").insert({
      couple_id: coupleId,
      category_id: categoryId,
      name,
      amount,
      period,
    });
    if (error) throw error;
  }

  revalidatePath("/budgets");
}

export async function deleteBudget(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/budgets");
}

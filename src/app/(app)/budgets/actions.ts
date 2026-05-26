"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Returns the user's couple_id, creating a solo household if none exists.
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
  const coupleId = await getCoupleId(); // always verify auth + get couple

  if (existingId) {
    const { error } = await supabase
      .from("budgets")
      .update({ amount, period })
      .eq("id", existingId)
      .eq("couple_id", coupleId); // ownership check
    if (error) throw error;
  } else {
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
  const coupleId = await getCoupleId(); // auth check

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("couple_id", coupleId); // ownership check
  if (error) throw error;

  revalidatePath("/budgets");
}

export async function createCategory(
  name: string,
  icon: string | null,
  color: string | null
) {
  const trimmed = name.trim().slice(0, 50);
  if (!trimmed) throw new Error("Name is required");

  const supabase = await createClient();
  const coupleId = await getCoupleId();

  const { error } = await supabase.from("categories").insert({
    couple_id: coupleId,
    name: trimmed,
    icon: icon || null,
    color: color || null,
    is_default: false,
  });
  if (error) throw error;

  revalidatePath("/budgets");
  revalidatePath("/transactions");
}

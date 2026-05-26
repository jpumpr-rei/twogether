"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateAccountName(cardId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({ account_name: trimmed })
    .eq("id", cardId);
  if (error) throw error;

  revalidatePath("/accounts");
}

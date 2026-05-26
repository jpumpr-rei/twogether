"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createHousehold(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data, error } = await supabase.rpc("create_couple_for_user");
  if (error) return { error: error.message };
  if (!data) return { error: "Failed to create household" };

  revalidatePath("/settings");
  return {};
}

export async function joinHousehold(
  inviteCode: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data, error } = await supabase.rpc("join_couple_by_code", {
    p_invite_code: inviteCode.trim().toUpperCase(),
  });

  if (error) return { error: error.message };

  const result = data as { error?: string; success?: boolean };

  if (result?.error === "invalid_code") return { error: "That code doesn't match any household. Double-check and try again." };
  if (result?.error === "own_couple") return { error: "That's your own invite code!" };
  if (result?.error === "couple_full") return { error: "That household already has two members." };
  if (result?.error) return { error: "Something went wrong. Please try again." };

  revalidatePath("/settings");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  return {};
}

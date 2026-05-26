"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("join_couple_by_code", {
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

export async function sendInviteEmail(
  toEmail: string
): Promise<{ error?: string }> {
  const trimmed = toEmail.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  // Get the sender's name and invite code
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, couple_id")
    .eq("id", user.id)
    .single();

  if (!profile?.couple_id) return { error: "Create a household first." };

  const { data: couple } = await supabase
    .from("couples")
    .select("invite_code")
    .eq("id", profile.couple_id)
    .single();

  if (!couple?.invite_code) return { error: "Could not find your invite code." };

  const senderName = profile.display_name?.split(" ")[0] ?? "Your partner";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = `${appUrl}/auth/callback?invite=${couple.invite_code}`;

  // Use Supabase admin to send the invite email.
  // This creates a magic signup link for new users using Supabase's built-in email.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo,
    data: {
      invite_code: couple.invite_code,
      invited_by: senderName,
    },
  });

  if (error) {
    // "User already registered" means they have an account — give them the code directly
    if (error.message.toLowerCase().includes("already")) {
      return { error: `That email already has an account. Ask them to open Settings in the app and enter code: ${couple.invite_code}` };
    }
    return { error: "Failed to send invite. Check the email and try again." };
  }

  return {};
}

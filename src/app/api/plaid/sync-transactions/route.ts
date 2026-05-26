import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCouple } from "@/lib/plaid/syncCouple";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  if (!profile?.couple_id) {
    return NextResponse.json({ error: "No household found" }, { status: 400 });
  }

  const { synced, errors } = await syncCouple(supabase, profile.couple_id);

  return NextResponse.json({
    synced,
    errors: errors.length > 0 ? errors : undefined,
  });
}

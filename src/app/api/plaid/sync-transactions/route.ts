import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCoupleForUser } from "@/lib/plaid/syncForUser";

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

  try {
    const { synced, errors } = await syncCoupleForUser(supabase, profile.couple_id);

    if (errors.length > 0) {
      // Surface the first error message to the client so the UI can display it.
      // Use 502 so SyncButton's !res.ok branch fires.
      return NextResponse.json(
        { error: errors[0], synced },
        { status: 502 }
      );
    }

    return NextResponse.json({ synced });
  } catch (err) {
    // Includes a missing SUPABASE_SERVICE_ROLE_KEY: logged for the developer, while the
    // user gets a message SyncButton can show (it reads `error` from the JSON body).
    console.error("Sync failed:", err);
    return NextResponse.json({ error: "Sync failed — please try again" }, { status: 500 });
  }
}

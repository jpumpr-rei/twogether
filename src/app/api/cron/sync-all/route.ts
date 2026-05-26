/**
 * Background cron route — syncs transactions for every couple.
 * Called by Vercel Cron every 2 hours.
 * Protected by the CRON_SECRET env var that Vercel injects automatically.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCouple } from "@/lib/plaid/syncCouple";

export async function GET(request: NextRequest) {
  // Vercel passes `Authorization: Bearer <CRON_SECRET>` on every cron invocation.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find all couples that have at least one connected card
  const { data: cardRows, error: cardError } = await supabase
    .from("cards")
    .select("couple_id")
    .not("plaid_access_token", "is", null)
    .not("couple_id", "is", null);

  if (cardError) {
    console.error("Cron: failed to fetch cards", cardError);
    return NextResponse.json({ error: cardError.message }, { status: 500 });
  }

  // Deduplicate couple IDs
  const coupleIds = [...new Set((cardRows ?? []).map((r) => r.couple_id as string))];
  const couples = coupleIds.map((id) => ({ id }));

  const results: { coupleId: string; synced: number; errors: string[] }[] = [];

  for (const couple of couples ?? []) {
    try {
      const { synced, errors } = await syncCouple(supabase, couple.id);
      results.push({ coupleId: couple.id, synced, errors });
    } catch (err) {
      console.error(`Cron: sync failed for couple ${couple.id}`, err);
      results.push({ coupleId: couple.id, synced: 0, errors: ["unexpected error"] });
    }
  }

  const totalSynced = results.reduce((s, r) => s + r.synced, 0);
  console.log(`Cron sync complete: ${results.length} couples, ${totalSynced} transactions`);

  return NextResponse.json({ couples: results.length, totalSynced });
}

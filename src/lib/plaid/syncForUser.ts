import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { syncCouple } from "./syncCouple";

type UserClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Syncs a household's Plaid items on behalf of a signed-in member — the Sync button,
 * pull-to-refresh, and linking a bank.
 *
 * This deliberately runs with the service-role client. A sync has to see every account of
 * a Plaid item to file each transaction under the right card. With the member's own client
 * an account hidden from them can't be matched, and its transactions were saved with no
 * card — which every member of the household can see.
 *
 * What the member may learn is still decided by their own session: we ask the database
 * which cards that session can read, and the sync only touches and reports on items that
 * include one of them (see syncScope.ts).
 *
 * `coupleId` must come from the caller's own profile, never from the request.
 */
export async function syncCoupleForUser(userSupabase: UserClient, coupleId: string) {
  // Created first so a missing SUPABASE_SERVICE_ROLE_KEY fails before any work is done.
  const admin = createAdminClient();

  const { data: visible, error } = await userSupabase
    .from("cards")
    .select("id")
    .eq("couple_id", coupleId);
  // Fail closed: an empty list would otherwise read as "nothing to sync".
  if (error) throw new Error(`Could not read the user's cards: ${error.message}`);

  const visibleCardIds = new Set((visible ?? []).map((c) => c.id));
  return syncCouple(admin, coupleId, { visibleCardIds });
}

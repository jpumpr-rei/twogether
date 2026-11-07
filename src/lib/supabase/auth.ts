import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Identifies the signed-in user from the session cookie.
 *
 * getClaims() verifies the JWT's signature locally against the project's published
 * signing key, so there is no round trip to Supabase Auth (unlike getUser(), which
 * makes a network call every time). It only touches the network when the access token
 * has expired and needs refreshing. Row-level security still enforces data access.
 */
export async function getClaimsUser(
  supabase: ServerClient
): Promise<{ id: string; email: string | null } | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/**
 * The signed-in user, their profile, and a Supabase client — looked up once per
 * request and shared by everything that renders in it. Redirects to /login when
 * there is no valid session.
 */
export const getAuth = cache(async () => {
  const supabase = await createClient();
  const user = await getClaimsUser(supabase);
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, couple_id")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
});

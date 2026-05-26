import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Handles the redirect after a Supabase email invite is clicked.
// Supabase appends ?token_hash=...&type=invite to whatever redirectTo URL we set.
// We include ?invite=CODE in the redirectTo so we can auto-join the household here.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const inviteCode = searchParams.get("invite");

  if (token_hash && type) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Exchange the token for a session
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "signup" | "magiclink" | "email",
    });

    if (!error && inviteCode) {
      // Auto-join the household using the invite code embedded in the link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("join_couple_by_code", {
        p_invite_code: inviteCode.trim().toUpperCase(),
      });
    }

    // Redirect to dashboard whether join succeeded or not
    // (they can always enter the code manually in Settings)
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // No token — send to login
  return NextResponse.redirect(`${origin}/login`);
}

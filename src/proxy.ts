import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Proxy runs on every navigation and every <Link> prefetch, so this check has to be
  // cheap: getClaims() verifies the session JWT locally and only goes to the network
  // when the token has expired and must be refreshed (which also rewrites the cookies
  // above). Pages and actions re-check before touching data, and the database enforces
  // access with row-level security, so this is only the optimistic redirect layer.
  const {
    data,
  } = await supabase.auth.getClaims();
  const isSignedIn = !!data?.claims?.sub;

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users to /login (except auth routes and public assets)
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublic = pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".");

  if (!isSignedIn && !isAuthRoute && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isSignedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Skip static files entirely — the service worker script, manifest, icons and other
  // assets don't need an auth check.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff|woff2)$).*)",
  ],
};

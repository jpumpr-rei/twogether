import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid/client";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use explicit app URL, or fall back to Vercel's auto-set hostname
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: "Twogether",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    ...(appUrl && { redirect_uri: `${appUrl}/plaid-oauth` }),
  });

  return NextResponse.json({ link_token: response.data.link_token });
}

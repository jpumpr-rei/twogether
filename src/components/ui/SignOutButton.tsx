"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="w-full text-center text-sm font-semibold text-red-500 bg-white rounded-2xl py-4 shadow-sm active:bg-red-50"
    >
      Sign out
    </button>
  );
}

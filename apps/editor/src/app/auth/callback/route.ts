import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/supabase/config";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Where email links (confirm, magic link, password reset) land: swaps the one-time code for a session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  // Same-origin paths only, so a crafted link cannot send the person to another site.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${appUrl()}${target}`);
  }
  return NextResponse.redirect(`${appUrl()}/sign-in?error=link`);
}

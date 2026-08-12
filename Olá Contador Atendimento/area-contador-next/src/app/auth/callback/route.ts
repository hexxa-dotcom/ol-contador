import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const destination =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/login?recovery=1";
  if (!code)
    return NextResponse.redirect(new URL("/login?erro=link", url.origin));

  const supabase = await createClient();
  if (!supabase)
    return NextResponse.redirect(new URL("/login?erro=config", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(new URL("/login?erro=link", url.origin));
  return NextResponse.redirect(new URL(destination, url.origin));
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseMiddleware } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = supabaseMiddleware(req);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !req.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (user && req.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/", "/diary/:path*", "/friends/:path*", "/login", "/diary/new"],
};
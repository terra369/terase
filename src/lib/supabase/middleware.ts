import { type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const supabaseMiddleware = (req: NextRequest) =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {}, // Edge runtimeでは書き込み不可なので無視
      },
    }
  );
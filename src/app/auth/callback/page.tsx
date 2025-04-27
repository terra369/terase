"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        (async () => {
            const supabase = supabaseBrowser;
            const { error } = await supabase.auth.exchangeCodeForSession(
                window.location.href
            );

            router.replace(
                error ? `/login?error=${encodeURIComponent(error.message)}` : "/"
            );
        })();
    }, [router]);

    return <p className="p-4">Signing in…</p>;
}
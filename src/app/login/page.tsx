"use client";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { MobileLoginCard } from "@/app/components/ui/mobile-login-card";

export default function LoginButton() {
    const signIn = async () => {
        const supabase = supabaseBrowser;
        supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback` },
        });
    };
    return (
        <main className="flex h-screen items-center justify-center p-4">
            {/* MobileLoginCard 側では onGoogle を呼ぶだけ */}
            <MobileLoginCard onGoogle={signIn} />
        </main>
    );
}
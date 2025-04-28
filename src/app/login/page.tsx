"use client";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { MobileLoginCard } from "@/app/components/ui/mobile-login-card";

export default function LoginButton() {
    const signIn = async () => {
        // 1) クライアント用 Supabase インスタンス
        const supabase = supabaseBrowser;

        // 2) redirect 先を決定しつつ、環境変数がなければ警告して中断
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
        if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production") {
            // 本番で値が無いのは致命的なので早期 return
            alert("環境変数 NEXT_PUBLIC_SITE_URL が設定されていません");
            return;
        }

        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${siteUrl}/auth/callback` },
        });
    };

    return (
        <main className="flex h-screen items-center justify-center p-4">
            {/* ボタン内部で signIn が呼ばれる */}
            <MobileLoginCard onGoogle={signIn} />
        </main>
    );
}
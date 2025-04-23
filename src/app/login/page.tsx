'use client'
import { MobileLoginCard } from '@/app/components/ui/mobile-login-card'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

export default function Login() {
    async function google() {
        await supabaseBrowser.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${location.origin}/auth/callback` }
        })
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4">
            <MobileLoginCard onGoogle={google} />
        </main>
    )
}
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { MobileLoginCard } from '@/app/components/ui/mobile-login-card'

export default function Login() {
    const router = useRouter()

    useEffect(() => {
        supabaseBrowser.auth.getUser().then(({ data }) => {
            if (data.user) router.replace('/')
        })
    }, [router])

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
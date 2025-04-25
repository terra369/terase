import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // dev 環境では Secure を無効化し localhost でも送信させる
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      },
      cookies: {
        getAll: () => store.getAll(),
        setAll: list => {
          try { list.forEach(c => store.set(c.name, c.value, c.options)) }
          catch { /* RSC では commit 不可の場合があるが無視可 */ }
        }
      }
    }
  )
}
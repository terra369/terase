import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabaseServer'


export async function middleware(req: NextRequest) {
  // Res を先に生成
  const res = NextResponse.next()
  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  console.log('user in middleware', user)

  // 未ログインで保護ルート → /login へ
  if (!user && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  // 既ログインなのに /login へ来たらホームへ
  if (user && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return res
}

export const config = {
  matcher: ['/', '/diary/:path*', '/friends/:path*', '/login', '/diary/new']
}
import { createBrowserClient } from '@supabase/ssr';

/** クライアントサイドで Storage API を呼ぶためのラッパ */
export const storageClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ).storage.from('diary-audio');
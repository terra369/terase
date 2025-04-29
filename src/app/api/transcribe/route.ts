import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { uploadAudio } from '@/lib/uploadAudio';
import { transcribe } from '@/lib/whisper';

export async function POST(req: NextRequest) {
  /* 1) 認証付き Supabase クライアントを取得 */
  const supabase = await supabaseServer();
  // --- debug: confirm authenticated session -----------------
  const { data: sess } = await supabase.auth.getSession();
  console.log('session role=', sess?.session?.user.role); // should be "authenticated"
  console.log('uid =',          sess?.session?.user.id);
  // -----------------------------------------------------------
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  /* 2) フォームデータから音声 Blob を取り出す */
  const form = await req.formData();
  const blob = form.get('audio') as Blob | null;
  if (!blob) {
    return NextResponse.json({ error: 'audio missing' }, { status: 400 });
  }

  try {
    /* 3) 音声を Private バケットへアップロード（owner=auth.uid()） */
    const { path, signedUrl } = await uploadAudio(blob, user.id, supabase);

    /* 4) Whisper で文字起こし */
    const transcript = await transcribe(signedUrl);

    /* 5) クライアントへレスポンス */
    return NextResponse.json({ audioPath: path, transcript });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? 'server error' }, { status: 500 });
  }
}
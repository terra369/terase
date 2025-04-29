import { NextRequest, NextResponse } from 'next/server';
import { saveDiary } from '@/app/actions/saveDiary';

export async function POST(req: NextRequest) {
  try {
    // ① JSON ペイロードを FormData へ変換
    const body = await req.json();
    const fd   = new FormData();
    Object.entries(body).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, String(v));
      });

    // ② 既存アクションを呼び出し
    await saveDiary(null, fd);

    // ③ 正常レスポンス
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(err);
    return NextResponse.json(
      { error: err.message ?? 'server error' },
      { status: 400 },
    );
  }
}
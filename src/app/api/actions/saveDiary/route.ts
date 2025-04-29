import { NextRequest, NextResponse } from 'next/server';
import { saveDiary } from '@/app/actions/saveDiary';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fd   = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (v != null) fd.append(k, String(v));
    });

    const diaryId = await saveDiary(null, fd);
    return NextResponse.json({ diaryId });
  } catch (e: unknown) {
    const msg =
      typeof e === 'object' && e !== null && 'message' in e
        ? (e as { message: string }).message
        : String(e);
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
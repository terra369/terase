import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/diaries/2025-04-27
 * → その日に対応する日記 1 件を返す（RLS で auth.uid () = user_id）
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { date: string } }
) {
  const { date } = params;

  // YYYY-MM-DD の簡易バリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new NextResponse('invalid date format', { status: 400 });
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('date', date)
    .single();

  if (error || !data) {
    return new NextResponse(error?.message ?? 'not found', { status: 404 });
  }
  return NextResponse.json(data);
}
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { date: string } }
) {
  const { date } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return new NextResponse('invalid date', { status: 400 });

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('diaries')
    .select('id, visibility, diary_messages(*)')
    .eq('date', date)
    .single();

  if (error || !data)
    return new NextResponse(error?.message ?? 'not found', { status: 404 });

  return NextResponse.json(data);
}
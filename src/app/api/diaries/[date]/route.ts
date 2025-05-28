import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return new NextResponse('invalid date', { status: 400 });

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('diaries')
    .select('id, date, visibility, diary_messages(*)')
    .eq('date', date)
    .single();

  if (error) {
    // If no diary found, return empty data instead of 404
    if (error.code === 'PGRST116') {
      return NextResponse.json({
        id: null,
        date: date,
        messages: []
      });
    }
    return new NextResponse(error.message, { status: 500 });
  }

  // Format the response to match the expected structure
  const formattedData = {
    id: data.id,
    date: data.date,
    messages: data.diary_messages || []
  };

  return NextResponse.json(formattedData);
}
import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();

  const month = req.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response('missing or invalid month param', { status: 400 });
  }

  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  
  // First get all diaries for the month
  const { data: diaries, error } = await supabase
    .from('diaries')
    .select('date, diary_messages(id)')
    .gte('date', `${month}-01`)
    .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`);

  if (error) return new Response(error.message, { status: 400 });
  
  // Transform the data to the expected format
  const result = diaries?.map(diary => ({
    date: diary.date,
    count: diary.diary_messages?.length || 0
  })) || [];
  
  return Response.json(result);
}
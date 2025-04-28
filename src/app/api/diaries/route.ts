import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();

  const month = req.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response('missing or invalid month param', { status: 400 });
  }

const { data, error } = await supabase
  .from('diary_month_summary')
  .select('*')
  .gte('date', `${month}-01`)
  .lte('date', `${month}-31`);

  if (error) return new Response(error.message, { status: 400 });
  return Response.json(data);
}
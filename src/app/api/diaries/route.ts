import { supabase } from '@/lib/supabase';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')!;
  const { data, error } = await supabase
    .from('diaries')
    .select('date,count,mood_emoji')
    .gte('date', `${month}-01`).lte('date', `${month}-31`)
    .eq('user_id', 'auth.uid()');
  if (error) return new Response(error.message, { status: 400 });
  return Response.json(data);
}
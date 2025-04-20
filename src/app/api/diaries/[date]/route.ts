import { NextRequest } from 'next/server';
import { supabase }  from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { date: string } }
) {
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('date', params.date)
    .single();

  if (error) {
    return new Response(error.message, { status: 404 });
  }
  return Response.json(data);
}
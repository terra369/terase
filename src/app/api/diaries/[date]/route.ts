import { NextRequest } from 'next/server';
import { supabase }   from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('date', date)
    .single();

  if (error) {
    return new Response(error.message, { status: 404 });
  }
  return Response.json(data);
}
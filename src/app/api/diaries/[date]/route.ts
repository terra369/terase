import { supabase } from '@/lib/supabase';
export async function GET(_: Request, { params }: { params: { date: string } }) {
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('date', params.date)
    .single();
  if (error) return new Response(error.message, { status: 404 });
  return Response.json(data);
}
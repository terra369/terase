import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/diaries/[date]
 */
export async function GET(
  _req: Request,
  context: { params: { date: string } }
) {
  const { date } = context.params;

  // YYYY-MM-DD の簡易バリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response('invalid date format', { status: 400 });
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('date', date)
    .single();

  if (error || !data) {
    return new Response(error?.message ?? 'not found', { status: 404 });
  }
  return Response.json(data);
}
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get('month');
  const year = req.nextUrl.searchParams.get('year');
  
  try {
    let query = supabase
      .from('diaries')
      .select('id, date, user_id')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      query = query
        .gte('date', `${month}-01`)
        .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (year && /^\d{4}$/.test(year)) {
      query = query
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching diary list:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
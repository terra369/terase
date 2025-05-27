import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get('month');
  const date = req.nextUrl.searchParams.get('date');

  try {
    let query = supabase
      .from('calendar_strokes')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (date) {
      query = query.eq('date', date);
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      query = query
        .gte('date', `${month}-01`)
        .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`);
    } else {
      return NextResponse.json({ error: 'Missing or invalid date/month parameter' }, { status: 400 });
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching calendar strokes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { date, stroke_data } = await req.json();

    if (!date || !stroke_data) {
      return NextResponse.json({ error: 'Missing date or stroke_data' }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Check if stroke data already exists for this date
    const { data: existingData, error: fetchError } = await supabase
      .from('calendar_strokes')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    let result;
    if (existingData) {
      // Update existing stroke data by merging new strokes
      const existingStrokes = existingData.stroke_data?.strokes || [];
      const newStrokes = stroke_data.strokes || [];
      
      const mergedStrokeData = {
        strokes: [...existingStrokes, ...newStrokes]
      };

      const { data, error } = await supabase
        .from('calendar_strokes')
        .update({ stroke_data: mergedStrokeData })
        .eq('id', existingData.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      result = data;
    } else {
      // Create new stroke record
      const { data, error } = await supabase
        .from('calendar_strokes')
        .insert({
          user_id: user.id,
          date,
          stroke_data
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      result = data;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error saving calendar stroke:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { date, stroke_data } = await req.json();

    if (!date || !stroke_data) {
      return NextResponse.json({ error: 'Missing date or stroke_data' }, { status: 400 });
    }

    // Replace entire stroke data for the date
    const { data, error } = await supabase
      .from('calendar_strokes')
      .upsert({
        user_id: user.id,
        date,
        stroke_data
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating calendar stroke:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('calendar_strokes')
      .delete()
      .eq('user_id', user.id)
      .eq('date', date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar stroke:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
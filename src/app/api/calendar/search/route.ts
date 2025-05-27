import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const emotion = searchParams.get('emotion') || '';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';

  try {
    // Build the base query
    let sqlQuery = supabase
      .from('diary_messages')
      .select(`
        id,
        diary_id,
        role,
        text,
        created_at,
        diaries!inner(date, user_id, mood_emoji)
      `)
      .eq('diaries.user_id', user.id)
      .order('diaries.date', { ascending: false });

    // Apply text search filter with sanitization
    if (query.length >= 2) {
      // Sanitize query to prevent SQL injection by escaping special characters
      const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
      sqlQuery = sqlQuery.ilike('text', `%${sanitizedQuery}%`);
    }

    // Apply emotion filter
    if (emotion) {
      sqlQuery = sqlQuery.eq('diaries.mood_emoji', emotion);
    }

    // Apply date range filter
    if (startDate) {
      sqlQuery = sqlQuery.gte('diaries.date', startDate);
    }
    if (endDate) {
      sqlQuery = sqlQuery.lte('diaries.date', endDate);
    }

    // Execute the query
    const { data, error } = await sqlQuery.limit(50);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Transform the results
    const results = data?.map((item: any) => ({
      diary_id: item.diary_id,
      date: item.diaries.date,
      role: item.role,
      text: item.text,
      created_at: item.created_at,
      mood_emoji: item.diaries.mood_emoji
    })) || [];

    // If we have a text query, add highlighting information
    if (query.length >= 2) {
      results.forEach((result: any) => {
        const index = result.text.toLowerCase().indexOf(query.toLowerCase());
        if (index !== -1) {
          // Extract context around the match
          const start = Math.max(0, index - 50);
          const end = Math.min(result.text.length, index + query.length + 50);
          result.highlight = result.text.substring(start, end);
          if (start > 0) result.highlight = '...' + result.highlight;
          if (end < result.text.length) result.highlight = result.highlight + '...';
        }
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in calendar search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
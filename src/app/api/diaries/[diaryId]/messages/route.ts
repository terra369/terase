import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { diaryId: string } }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const diaryId = parseInt(params.diaryId);
  
  if (isNaN(diaryId)) {
    return NextResponse.json({ error: 'Invalid diary ID' }, { status: 400 });
  }

  try {
    // First, verify the user has access to this diary
    const { data: diary, error: diaryError } = await supabase
      .from('diaries')
      .select('user_id')
      .eq('id', diaryId)
      .single();

    if (diaryError) {
      return NextResponse.json({ error: 'Diary not found' }, { status: 404 });
    }

    // Check if user owns the diary or is a friend with access
    const { data: friendCheck } = await supabase
      .from('friends')
      .select('status')
      .eq('user_id', user.id)
      .eq('friend_user_id', diary.user_id)
      .eq('status', 'accepted')
      .single();

    const hasAccess = diary.user_id === user.id || friendCheck;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch all messages for the diary
    const { data: messages, error: messagesError } = await supabase
      .from('diary_messages')
      .select('*')
      .eq('diary_id', diaryId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 400 });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching diary messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
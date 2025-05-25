import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { diaryId, role, text, audioUrl, triggerAI = false } = await req.json();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  // Insert the message
  const { data: messageData, error } = await supabase
    .from('diary_messages')
    .insert({ diary_id: diaryId, role, text, audio_url: audioUrl })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  // If this is a user message and triggerAI is true, call the Edge Function
  if (role === 'user' && triggerAI) {
    try {
      const aiReplyResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai_reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ record: messageData })
        }
      );

      if (aiReplyResponse.ok) {
        const aiResult = await aiReplyResponse.json();
        return NextResponse.json({ ok: true, aiReply: aiResult });
      } else {
        console.error('AI reply failed:', await aiReplyResponse.text());
      }
    } catch (aiError) {
      console.error('Error calling AI reply:', aiError);
    }
  }

  return NextResponse.json({ ok: true });
}
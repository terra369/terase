'use server';

import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const diarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().min(1),
});
type DiaryInput = z.infer<typeof diarySchema>;

export async function saveDiary(
  _prev: unknown,
  fd: FormData,
): Promise<number> {
  const parsed = diarySchema.safeParse({
    date: fd.get('date'),
    text: fd.get('text'),
  });
  if (!parsed.success) throw new Error(parsed.error.message);
  const input: DiaryInput = parsed.data;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('diaries')
    .upsert(
      { user_id: user.id, date: input.date },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    )
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert failed');

  const diaryId = data.id;

  const { error: mErr } = await supabase
    .from('diary_messages')
    .insert({
      diary_id:  diaryId,
      role:      'user',
      text:      input.text,
      audio_url: null,
    });
  if (mErr) throw mErr;

  return diaryId;
}
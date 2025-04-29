'use server';

import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

/* === 入力バリデーション ========================================= */
const diarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().min(1),
  fairy: z.string().nullish().default(''),
  mood:  z.string().emoji('1つの絵文字を入力してください').nullish(),
  audioPath: z.string().min(1),
  fairyAudioUrl: z.string().url().nullish(),
});

type DiaryInput = z.infer<typeof diarySchema>;

/* === 日記保存アクション ========================================= */
export async function saveDiary(_prev: unknown, fd: FormData) {
  /* 1) フォーム値を Zod で検証 */
  const parsed = diarySchema.safeParse({
    date: fd.get('date'),
    text: fd.get('text'),
    fairy: fd.get('fairy'),
    mood: fd.get('mood'),
    audioPath: fd.get('audioPath'),
    fairyAudioUrl: fd.get('fairyAudioUrl'),
  });
  if (!parsed.success) throw new Error(parsed.error.message);
  const input: DiaryInput = parsed.data;

  /* 2) 認証ユーザーを取得 */
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  /* 3) diaries へ UPSERT */
  const { error } = await supabase
    .from('diaries')
    .upsert({
      user_id: user.id,
      date: input.date,
      user_text: input.text,
      fairy_text: input.fairy ?? null,
      mood_emoji: input.mood,
      user_audio_url: input.audioPath,
      fairy_audio_url: input.fairyAudioUrl ?? null,
    });

  if (error) throw error;
}
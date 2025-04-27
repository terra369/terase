'use server'

import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

const diarySchema = z.object({
  // YYYY-MM-DD
  date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text:  z.string().min(1),
  fairy: z.string().optional().default(''),
  mood:  z.string().emoji('1つの絵文字を入力してください').optional(),
  audioUrl:       z.string().url().optional(),
  fairyAudioUrl:  z.string().url().optional(),
})

type DiaryInput = z.infer<typeof diarySchema>

export async function saveDiary (_prev: unknown, fd: FormData) {
  const parsed = diarySchema.safeParse({
    date:  fd.get('date'),
    text:  fd.get('text'),
    fairy: fd.get('fairy'),
    mood:  fd.get('mood'),
    audioUrl:      fd.get('audioUrl'),
    fairyAudioUrl: fd.get('fairyAudioUrl'),
  })

  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }
  const input: DiaryInput = parsed.data

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('diaries')
    .upsert({
      user_id: user.id,
      date:    input.date,
      user_text:      input.text,
      fairy_text:     input.fairy,
      mood_emoji:     input.mood,
      user_audio_url:  input.audioUrl,
      fairy_audio_url: input.fairyAudioUrl,
    })

  if (error) throw error
}
"use server";
import { supabase } from '@/lib/supabase';

export async function saveDiary(_: any, fd: FormData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('認証が必要です');

    await supabase.from('diaries').upsert({
    user_id: user.id,
    date: fd.get('date'),
    user_text: fd.get('text'),
    fairy_text: fd.get('fairy'),
    mood_emoji: fd.get('mood'),
    user_audio_url: fd.get('audioUrl'),
    fairy_audio_url: fd.get('fairyAudioUrl'),
    });
}
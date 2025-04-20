import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export default async function DiaryDetail({ params: { date } }: { params: { date: string } }) {
    const { data } = await supabase
        .from('diaries')
        .select('user_text,fairy_text,user_audio_url,mood_emoji')
        .eq('date', date).single();

    if (!data) return <p className="p-6">記録がありません</p>;

    return (
        <main className="max-w-xl mx-auto p-6 space-y-4">
            <h1 className="text-xl font-bold">
                {format(new Date(date), 'yyyy年M月d日')} {data.mood_emoji}
            </h1>
            <p className="whitespace-pre-wrap">{data.user_text}</p>
            <p className="text-green-700 whitespace-pre-wrap">{data.fairy_text}</p>
            {data.user_audio_url && <audio controls src={data.user_audio_url} className="w-full" />}
        </main>
    );
}
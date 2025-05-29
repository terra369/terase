import { supabaseServer } from '@/lib/supabase/server';
import { format } from 'date-fns';
import DiaryDetailClient from './DiaryDetailClient';

export default async function DiaryDetail(
    { params }: { params: Promise<{ date: string }> },
) {
    const { date } = await params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return <p className="p-6 text-red-600">URL が不正です</p>;

    const supabase = await supabaseServer();
    const { data } = await supabase
        .from('diaries')
        .select('id, diary_messages(*)')
        .eq('date', date)
        .single();
    if (!data) return <p className="p-6">記録がありません</p>;

    const msgs = await Promise.all(
        data.diary_messages.map(async (m) => {
            if (!m.audio_url) return m;
            const { data: sig, error } = await supabase.storage
                .from('diary-audio')
                .createSignedUrl(m.audio_url, 600);
            return { ...m, signed: error ? null : sig?.signedUrl };
        }),
    );

    msgs.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

    return (
        <main className="max-w-[390px] md:max-w-xl lg:max-w-2xl mx-auto p-4 md:p-6">
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold mb-3 md:mb-4">
                {format(new Date(date), 'yyyy年M月d日')}
            </h1>
            {/* Client Component に渡す */}
            <DiaryDetailClient diaryId={data.id} initialMsgs={msgs} />
        </main>
    );
}
import { supabaseServer } from '@/lib/supabase/server';
import { format } from 'date-fns';

export default async function DiaryDetail(
    { params }: { params: Promise<{ date: string }> }
) {
    // ❶ dynamic route の params は必ず await して展開
    const { date } = await params;

    // ❷ YYYY-MM-DD の簡易バリデーション
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return <p className="p-6 text-red-600">URL が不正です</p>;
    }

    // ❸ supabaseServer は同期関数なので await 不要
    const supabase = await supabaseServer();

    const { data } = await supabase
        .from('diaries')
        .select(
            'user_text,fairy_text,user_audio_url,fairy_audio_url,mood_emoji'
        )
        .eq('date', date)
        .maybeSingle();

    if (!data) return <p className="p-6">記録がありません</p>;

    return (
        <main className="max-w-xl mx-auto p-6 space-y-4">
            <h1 className="text-xl font-bold">
                {format(new Date(date), 'yyyy年M月d日')} {data.mood_emoji}
            </h1>

            {/* ユーザー入力 */}
            <p className="whitespace-pre-wrap">{data.user_text}</p>

            {/* 妖精フィードバック */}
            <p className="text-green-700 whitespace-pre-wrap">{data.fairy_text}</p>

            {/* ユーザー音声 */}
            {data.user_audio_url && (
                <audio
                    controls
                    src={data.user_audio_url}
                    className="w-full mb-4"
                />
            )}

            {/* 妖精音声 */}
            {data.fairy_audio_url && (
                <audio controls src={data.fairy_audio_url} className="w-full" />
            )}
        </main>
    );
}
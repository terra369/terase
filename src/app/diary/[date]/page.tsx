import { supabaseServer } from '@/lib/supabase/server';
import { format } from 'date-fns';

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

    const messages = [...data.diary_messages].sort(
        (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
    );

    return (
        <main className="max-w-xl mx-auto p-6 space-y-4">
            <h1 className="text-xl font-bold">
                {format(new Date(date), 'yyyy年M月d日')}
            </h1>

            {messages.map(m => (
                <div key={m.id} className={m.role === 'ai' ? 'text-green-700' : ''}>
                    {m.text}
                    {m.audio_url && (
                        <audio controls src={m.audio_url} className="w-full mt-1" />
                    )}
                </div>
            ))}
        </main>
    );
}
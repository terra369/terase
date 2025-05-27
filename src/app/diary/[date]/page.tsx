import { supabaseServer } from '@/lib/supabase/server';
import { format } from 'date-fns';
import DiaryDetailClient from './DiaryDetailClient';
import ConversationReplay from '@/components/ConversationReplay';
import Link from 'next/link';

export default async function DiaryDetail(
    { params, searchParams }: { 
        params: Promise<{ date: string }>,
        searchParams?: Promise<{ replay?: string }>
    },
) {
    const { date } = await params;
    const search = await searchParams;
    const isReplayMode = search?.replay === 'true';

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
        <main className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold">
                    {format(new Date(date), 'yyyy年M月d日')}
                </h1>
                <div className="flex space-x-2">
                    <Link
                        href={`/diary/${date}${isReplayMode ? '' : '?replay=true'}`}
                        className={`
                            px-4 py-2 rounded-lg transition-colors
                            ${isReplayMode 
                                ? 'bg-gray-500 hover:bg-gray-600 text-white' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }
                        `}
                    >
                        {isReplayMode ? '📝 Edit Mode' : '🎬 Replay Mode'}
                    </Link>
                    <Link
                        href="/calendar"
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    >
                        📅 Calendar
                    </Link>
                </div>
            </div>

            {isReplayMode ? (
                <ConversationReplay
                    diaryId={data.id}
                    date={date}
                    autoPlay={false}
                />
            ) : (
                <DiaryDetailClient diaryId={data.id} initialMsgs={msgs} />
            )}
        </main>
    );
}
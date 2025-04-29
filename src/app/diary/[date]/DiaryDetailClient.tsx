'use client';

import { useState, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useDiaryRealtime } from '@/lib/useDiaryRealtime';

type Msg = {
    id: number;
    role: 'user' | 'ai';
    text: string;
    audio_url: string | null;
    signed?: string | null;
    created_at: string;
};

export default function DiaryDetailClient(
    { diaryId, initialMsgs }: { diaryId: number; initialMsgs: Msg[] },
) {
    const [messages, setMessages] = useState<Msg[]>(initialMsgs);

    /* 署名 URL を付与して state 追加 */
    const handleInsert = useCallback(async (m: Msg) => {
        if (m.audio_url) {
            const { data } = await supabaseBrowser
                .storage
                .from('diary-audio')
                .createSignedUrl(m.audio_url, 600);
            m.signed = data?.signedUrl ?? null;
        }
        setMessages((prev) => [...prev, m]);
    }, []);

    useDiaryRealtime(diaryId, handleInsert);

    return (
        <div className="space-y-4">
            {messages.map((m) => (
                <div key={m.id} className={m.role === 'ai' ? 'text-green-700' : ''}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.signed && (
                        <audio controls src={m.signed} className="w-full mt-1" />
                    )}
                </div>
            ))}
        </div>
    );
}
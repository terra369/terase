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

// Simple HUD Toast component for notifications
// 現在は使用していないため後で必要になったら使う
/* 
const HUDToast = () => (
    <div className="bg-blue-900/80 text-blue-100 p-3 rounded-lg border border-blue-400/50 backdrop-blur-sm fixed top-4 right-4 z-50">
        <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <p>AI is processing a deep response...</p>
        </div>
    </div>
);
*/



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
        <div className="space-y-3 md:space-y-4 relative">
            {/* Chat messages */}
            <div className="space-y-3 md:space-y-4 max-h-[60vh] md:max-h-[50vh] overflow-y-auto p-1 md:p-2">
                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`p-3 md:p-4 rounded-lg text-sm md:text-base ${m.role === 'ai'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-2 md:ml-4'
                            : 'bg-gray-50 dark:bg-gray-800/30 mr-2 md:mr-4'}`}
                    >
                        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    </div>
                ))}
            </div>

        </div>
    );
}
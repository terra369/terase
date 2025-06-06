'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useDiary } from '@/core/hooks/useDiary';

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
    { diaryId, initialMsgs, date }: { diaryId: number; initialMsgs: Msg[]; date: string },
) {
    const [localMessages, setLocalMessages] = useState<Msg[]>(initialMsgs);
    
    // Use centralized diary hook for real-time updates
    const { messages: diaryMessages, getDiary } = useDiary();

    // Load diary data on mount
    useEffect(() => {
        getDiary(date);
    }, [getDiary, date]);

    // Update local messages when diary messages change
    useEffect(() => {
        const updateMessagesWithSignedUrls = async () => {
            const messagesWithUrls = await Promise.all(
                diaryMessages.map(async (msg) => {
                    let signed: string | null = null;
                    if (msg.audio_url) {
                        const { data } = await supabaseBrowser
                            .storage
                            .from('diary-audio')
                            .createSignedUrl(msg.audio_url, 600);
                        signed = data?.signedUrl ?? null;
                    }
                    return {
                        id: msg.id,
                        role: msg.role,
                        text: msg.text,
                        audio_url: msg.audio_url,
                        signed,
                        created_at: msg.created_at
                    } as Msg;
                })
            );
            setLocalMessages(messagesWithUrls);
        };

        if (diaryMessages.length > 0) {
            updateMessagesWithSignedUrls();
        }
    }, [diaryMessages]);

    return (
        <div className="space-y-3 md:space-y-4 relative">
            {/* Chat messages */}
            <div className="space-y-3 md:space-y-4 max-h-[60vh] md:max-h-[50vh] overflow-y-auto p-1 md:p-2">
                {localMessages.map((m) => (
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
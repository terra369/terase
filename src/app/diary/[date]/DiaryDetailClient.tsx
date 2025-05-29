'use client';

import { useState, useCallback } from 'react';
import { useDiaryRealtime } from '@/lib/useDiaryRealtime';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Msg = {
    id: number;
    role: 'user' | 'ai';
    text: string;
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

// Chat input component
const ChatInput = ({ onSend }: { onSend: (text: string) => Promise<void> }) => {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSend(message.trim());
            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex space-x-2 mt-4">
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="メッセージを入力..."
                className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
            />
            <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-md text-white ${isSubmitting ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
                {isSubmitting ? '送信中...' : '送信'}
            </button>
        </form>
    );
};

// Format timestamp for display
const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

export default function DiaryDetailClient(
    { diaryId, initialMsgs }: { diaryId: number; initialMsgs: Msg[] },
) {
    // Sort messages by creation time (oldest first)
    const sortedInitialMsgs = [...initialMsgs].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const [messages, setMessages] = useState<Msg[]>(sortedInitialMsgs);

    /* メッセージ追加時の処理（時系列順を維持） */
    const handleInsert = useCallback((m: Msg) => {
        setMessages((prev) => {
            const newMessages = [...prev, m];
            // Sort by creation time to maintain chronological order
            return newMessages.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
        });
    }, []);

    /* 送信処理 */
    const handleSend = async (text: string) => {
        // Add user message to the UI immediately
        const tempUserMsg: Msg = {
            id: Date.now(),
            role: 'user',
            text,
            created_at: new Date().toISOString()
        };
        setMessages(prev => {
            const newMessages = [...prev, tempUserMsg];
            return newMessages.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
        });

        // Send to AI function
        await fetch("/api/functions/v1/ai_reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, diaryId })
        });

        // Subscribe to deep broadcast channel for text updates only
        supabaseBrowser
            .channel(`diary_${diaryId}`)
            .on("broadcast", { event: "deep" }, () => {
                // Show HUD notification
                const hudContainer = document.createElement('div');
                document.body.appendChild(hudContainer);
                const hudToast = document.createElement('div');
                hudToast.innerHTML = 'AI is processing a deep response...';
                hudToast.className = 'bg-blue-900/80 text-blue-100 p-3 rounded-lg fixed top-4 right-4 z-50';
                hudContainer.appendChild(hudToast);
                setTimeout(() => hudContainer.remove(), 5000);
            })
            .subscribe();
    };

    useDiaryRealtime(diaryId, handleInsert);

    return (
        <div className="space-y-4 relative">
            {/* Chat messages with timestamps */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto p-2">
                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`p-4 rounded-lg ${m.role === 'ai'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-4'
                            : 'bg-gray-50 dark:bg-gray-800/30 mr-4'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-medium ${m.role === 'ai' 
                                ? 'text-blue-600 dark:text-blue-400' 
                                : 'text-gray-600 dark:text-gray-400'}`}>
                                {m.role === 'ai' ? 'AI' : 'あなた'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTimestamp(m.created_at)}
                            </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-base">
                            {m.text}
                        </p>
                    </div>
                ))}
            </div>

            {/* Chat input */}
            <ChatInput onSend={handleSend} />
        </div>
    );
}
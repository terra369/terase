'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useDiaryRealtime } from '@/lib/useDiaryRealtime';
import { Canvas } from '@react-three/fiber';
import { BallBot } from '@/components/BallBot';
import { useAudioReactive } from '@/components/hooks/useAudioReactive';

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

// 音声再生コンポーネント（BallBotと連動する）
const AudioPlayerWithReactive = ({ src }: { src: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const { setupExistingAudio } = useAudioReactive();
    
    useEffect(() => {
        if (audioRef.current) {
            // 音声要素をセットアップ
            setupExistingAudio(audioRef.current);
        }
    }, [setupExistingAudio]);
    
    return <audio ref={audioRef} controls src={src} className="w-full mt-1" />;
};

export default function DiaryDetailClient(
    { diaryId, initialMsgs }: { diaryId: number; initialMsgs: Msg[] },
) {
    const [messages, setMessages] = useState<Msg[]>(initialMsgs);
    const { speak } = useAudioReactive();

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

    /* 送信処理 */
    const handleSend = async (text: string) => {
        // Add user message to the UI immediately
        const tempUserMsg: Msg = {
            id: Date.now(),
            role: 'user',
            text,
            audio_url: null,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMsg]);

        // Send to AI function
        const { data } = await fetch("/api/functions/v1/ai_reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, diaryId })
        }).then(res => res.json());

        // Speak the reply
        if (data?.replyText) {
            await speak(data.replyText);
        }

        // Subscribe to deep broadcast channel
        supabaseBrowser
            .channel(`diary_${diaryId}`)
            .on("broadcast", { event: "deep" }, payload => {
                // Show HUD notification
                const hudContainer = document.createElement('div');
                document.body.appendChild(hudContainer);
                const hudToast = document.createElement('div');
                hudToast.innerHTML = 'AI is processing a deep response...';
                hudToast.className = 'bg-blue-900/80 text-blue-100 p-3 rounded-lg fixed top-4 right-4 z-50';
                hudContainer.appendChild(hudToast);
                setTimeout(() => hudContainer.remove(), 5000);

                if (payload.text) speak(payload.text);
            })
            .subscribe();
    };

    useDiaryRealtime(diaryId, handleInsert);

    return (
        <div className="space-y-4 relative">
            {/* 3D Visualization */}
            <div className="h-60 w-full rounded-lg overflow-hidden mb-4 border border-blue-100 dark:border-blue-900 shadow-md">
                <Canvas camera={{ position: [0, 0, 3] }}>
                    <Suspense fallback={null}>
                        <BallBot />
                        <ambientLight intensity={0.4 as any} />
                    </Suspense>
                </Canvas>
            </div>

            {/* Chat messages */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto p-2">
                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`p-3 rounded-lg ${m.role === 'ai'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-4'
                            : 'bg-gray-50 dark:bg-gray-800/30 mr-4'}`}
                    >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        {m.signed && (
                            <AudioPlayerWithReactive src={m.signed} />
                        )}
                    </div>
                ))}
            </div>

            {/* Chat input */}
            <ChatInput onSend={handleSend} />
        </div>
    );
}
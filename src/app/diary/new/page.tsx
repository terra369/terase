'use client';
import { useRouter } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';
import VoiceRecorder from '@/components/VoiceRecorder';
import { Canvas } from '@react-three/fiber';
import { BallBot } from '@/components/BallBot';
import { useAudioStore } from '@/stores/useAudioStore';
// useRecorder is imported in VoiceRecorder component, not needed here
// import { useRecorder } from '@/components/hooks/useRecorder';

export default function NewDiary() {
    const router = useRouter();
    const [status, setStatus] = useState<string | null>(null);

    async function fetchJSON(input: RequestInfo, init?: RequestInit) {
        const res = await fetch(input, init);
        if (!res.ok) {
            const { error } = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(error);
        }
        return res.json();
    }

    /* 最大 3 往復まで */
    async function onFinish(blob: Blob) {
        try {
            /* 1) 音声をアップロード & 文字起こし */
            setStatus('アップロード中…');
            const fd = new FormData();
            fd.append('audio', blob);
            const { audioPath, transcript } = await fetchJSON('/api/transcribe', {
                method: 'POST',
                body: fd,
            });

            /* 2) diaries upsert + 初回メッセージ保存 */
            setStatus('保存中…');
            const { diaryId } = await fetchJSON('/api/actions/saveDiary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString().slice(0, 10),
                    text: transcript,
                    audioPath,
                }),
            });

            /* 3) AI 返信を最大 2 回生成（Edge Function 推奨）*/
            await fetchJSON('/api/diaries/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    diaryId,
                    role: 'ai',
                    text: '',
                }),
            });

            router.push(`/diary/${new Date().toISOString().slice(0, 10)}`);
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            console.error(err);
            setStatus(`エラー: ${err.message}`);
        }
    }

    // Add amp to audio store when recording for visualization reactivity
    const setAmp = useAudioStore(state => state.setAmp);
    const [isAnimating, setIsAnimating] = useState(false);

    // Simulate audio reactivity during recording
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (isAnimating) {
            intervalId = setInterval(() => {
                // Generate random amplitude value between 0.1 and 0.8 to simulate voice activity
                setAmp(0.1 + Math.random() * 0.7);
            }, 100);
        } else {
            setAmp(0); // Reset amplitude when not recording
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
            setAmp(0); // Reset on cleanup
        };
    }, [isAnimating, setAmp]);

    // Custom VoiceRecorder that also triggers animation
    const handleRecordingState = (isRecording: boolean, blob?: Blob) => {
        setIsAnimating(isRecording);
        if (!isRecording && blob) {
            onFinish(blob);
        }
    };

    return (
        <main className="p-6 max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-center">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-600">
                    Speak Your Gratitude
                </span>
            </h1>

            {/* 3D Visualization */}
            <div className="h-60 w-full rounded-lg overflow-hidden mb-4 border border-blue-100 dark:border-blue-900 shadow-md">
                <Canvas camera={{ position: [0, 0, 3] }}>
                    <Suspense fallback={null}>
                        <BallBot />
                        <ambientLight intensity={0.4 as any} />
                    </Suspense>
                </Canvas>
            </div>

            <div className="bg-white/50 dark:bg-gray-900/50 p-4 rounded-lg shadow-md backdrop-blur-sm">
                <VoiceRecorder onStateChange={handleRecordingState} />
                {status && (
                    <div className="mt-4 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 animate-pulse">
                        <p className="text-sm">{status}</p>
                    </div>
                )}
            </div>
        </main>
    );
}
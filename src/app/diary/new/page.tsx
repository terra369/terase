'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import VoiceRecorder from '@/components/VoiceRecorder';

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

    return (
        <main className="p-4 space-y-4">
            <h1 className="text-xl font-bold">Speak your gratitude</h1>
            <VoiceRecorder onFinish={onFinish} />
            {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </main>
    );
}
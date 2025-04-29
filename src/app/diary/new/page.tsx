'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import VoiceRecorder from '@/components/VoiceRecorder';

export default function NewDiary() {
    const router = useRouter();
    const [status, setStatus] = useState<string | null>(null);

    /** 共通ヘルパ: fetch + JSON + エラーハンドリング */
    async function fetchJSON(input: RequestInfo, init?: RequestInit) {
        try {
            const ctl = AbortSignal.timeout(10_000);
            const res = await fetch(input, { ...init, signal: ctl });

            // HTTP レベルのエラーを捕捉
            if (!res.ok) {
                const { error } = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(error ?? `HTTP ${res.status}`);
            }

            return await res.json();
        } catch (e) {
            // ネットワーク or JSON 解析エラー
            if (e instanceof DOMException && e.name === 'TimeoutError') {
                throw new Error('タイムアウトしました');
            }
            throw e;
        }
    }

    /* 音声録音が終わったあとの処理 */
    async function onFinish(blob: Blob) {
        try {
            setStatus('アップロード中…');

            // 1) 録音ファイルを Whisper へ
            const fd = new FormData();
            fd.append('audio', blob);
            const { audioPath, transcript } = await fetchJSON('/api/transcribe', {
                method: 'POST',
                body: fd,
                credentials: 'include',
            });

            // 2) 日記保存
            setStatus('保存中…');
            await fetchJSON('/api/actions/saveDiary', {
                method: 'POST',
                body: JSON.stringify({
                    date: new Date().toISOString().slice(0, 10),
                    text: transcript,
                    audioPath,
                }),
                headers: { 'Content-Type': 'application/json' },
            });

            // 3) 完了
            router.push('/');
        } catch (e: any) {
            console.error(e);
            setStatus(`エラー: ${e.message}`);
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
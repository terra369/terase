'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { CalendarDaysIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import BallBot from '@/components/BallBot';
import { useAudioStore } from '@/stores/useAudioStore';
import { useRouter } from 'next/navigation';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { Canvas } from '@react-three/fiber';

type HomeClientProps = {
  userName: string;
};

export default function HomeClient({ userName }: HomeClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  
  // オーディオストアの状態を管理
  const setSpeaking = useAudioStore(state => state.setSpeaking);
  const setAmp = useAudioStore(state => state.setAmp);
  
  // カスタムフックから録音機能を取得
  const { recording, audioBlob, start, stop } = useVoiceRecorder((blob) => {
    // 録音完了時のコールバック - 文字起こしと保存を開始
    handleAudioFinished(blob);
  });

  // AI応答中のアニメーション効果 - より滑らかなアニメーションに修正
  useEffect(() => {
    // アニメーション用の値を追跡する変数
    let animationFrameId: number;
    let startTime = Date.now();
    
    if (aiResponding) {
      // AI応答中は滑らかな波形で動かす
      setSpeaking(true);
      
      const animateAmp = () => {
        // 経過時間に基づいた正弦波で滑らかな変化を作る
        const elapsed = (Date.now() - startTime) / 1000;
        
        // 複数の正弦波を組み合わせて自然な動きに
        const baseAmp = 0.1; // 基本の振幅
        const wave1 = Math.sin(elapsed * 0.8) * 0.05; // メインのゆっくりした波
        const wave2 = Math.sin(elapsed * 1.2) * 0.02; // 少し早い微小な波
        
        // 組み合わせた振幅を設定
        setAmp(baseAmp + wave1 + wave2);
        
        if (aiResponding) {
          animationFrameId = requestAnimationFrame(animateAmp);
        }
      };
      
      animateAmp();
    } else {
      // 応答終了時
      setSpeaking(false);
      setAmp(0);
    }
    
    return () => {
      // クリーンアップ: アニメーションを停止
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setSpeaking(false);
      setAmp(0);
    };
  }, [aiResponding, setSpeaking, setAmp]);

  // JSON取得用のヘルパー関数 - 改善されたエラーハンドリング
  async function fetchJSON(input: RequestInfo, init?: RequestInit) {
    try {
      // リクエストオプションを拡張
      const options = {
        ...init,
        headers: {
          ...(init?.headers || {}),
          'Cache-Control': 'no-cache',
        },
      };
      
      const res = await fetch(input, options);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        console.error(`API エラー: ${input}`, error);
        throw new Error(error || `リクエストエラー (${res.status})`);
      }
      return res.json();
    } catch (err) {
      console.error(`リクエスト失敗: ${input}`, err);
      throw err;
    }
  }

  // 音声処理完了時のハンドラー
  const handleAudioFinished = useCallback(async (blob: Blob) => {
    try {
      setProcessingAudio(true);
      setStatus('音声を処理中...');
      
      // 1) 音声をアップロード & 文字起こし
      const fd = new FormData();
      fd.append('audio', blob);
      const { audioPath, transcript } = await fetchJSON('/api/transcribe', {
        method: 'POST',
        body: fd,
      });
      
      // 2) 文字起こし結果を表示
      setStatus('AIが考え中...');
      setResponseText(transcript);
      
      // 3) 日記データの保存
      setAiResponding(true);
      setStatus('保存中...');
      const today = new Date().toISOString().slice(0, 10);
      const { diaryId } = await fetchJSON('/api/actions/saveDiary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          text: transcript,
          audioPath,
        }),
      });
      
      // 4) AI応答の生成
      setStatus('AIが考え中...');
      await fetchJSON('/api/diaries/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diaryId,
          role: 'ai',
          text: '',
        }),
      });
      
      // 5) 応答を表示
      setAiResponding(false);
      setStatus('保存完了');
      
      // 6) 少し待ってから新しい日記ページに遷移
      setTimeout(() => {
        router.push(`/diary/${today}`);
      }, 1500);
      
    } catch (error) {
      console.error('音声処理エラー:', error);
      setStatus('エラーが発生しました');
    } finally {
      setProcessingAudio(false);
    }
  }, [router]);

  return (
    <main className="w-screen h-screen bg-white flex items-center justify-center relative overflow-hidden">
      {/* スマートフォン対応のコンテナ */}
      <div className="w-full h-full max-w-md mx-auto relative">
        {/* JARVIS風の球体AI */}
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 3] }}>
            <Suspense fallback={null}>
              <BallBot />
              {/* eslint-disable-next-line react/no-unknown-property */}
              <ambientLight intensity={0.4} />
            </Suspense>
          </Canvas>
        </div>

        {/* 録音レイヤー - 処理中は無効化 */}
        {!processingAudio && (
          <div
            className="fixed inset-0 z-10"
            onPointerDown={start}
            onPointerUp={stop}
            onPointerCancel={stop}
            onKeyDown={e => e.code === 'Space' && start()}
            onKeyUp={e => e.code === 'Space' && stop()}
            role="button"
            aria-label="Hold to talk"
            tabIndex={0}
          >
            {/* ラベル */}
            <p className={`absolute bottom-12 w-full text-center text-lg select-none pointer-events-none
              ${recording ? 'text-red-400' : 'text-gray-300'}`}>
              {recording ? 'Recording…' : 'Hold to talk'}
            </p>
          </div>
        )}
        
        {/* 処理状態とAI応答 */}
        {processingAudio && (
          <div className="absolute inset-x-0 bottom-1/3 z-20 px-6">
            <div className="bg-black bg-opacity-50 text-white p-4 rounded-lg backdrop-blur-sm">
              {status && (
                <p className="text-center text-sm text-blue-300 mb-2">{status}</p>
              )}
              {responseText && (
                <p className="text-base">"{responseText}"</p>
              )}
            </div>
          </div>
        )}
        
        {/* ヘッダー (ユーザー名表示など) */}
        <header className="absolute top-4 left-4 right-4 z-20">
          <div className="text-white text-opacity-80 text-sm">
            Hello, {userName}
          </div>
        </header>

        {/* フッターナビゲーション */}
        <footer className="absolute bottom-4 right-5 z-20 flex space-x-4">
          <Link href="/diary" aria-label="View diary entries"
            className="text-gray-300 hover:text-white transition-colors">
            <CalendarDaysIcon className="h-8 w-8" />
          </Link>
        </footer>
      </div>
    </main>
  );
}

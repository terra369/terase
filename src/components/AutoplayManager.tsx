'use client'
import { useState, useEffect, useCallback } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';

interface AutoplayManagerProps {
  children: React.ReactNode;
}

export function AutoplayManager({ children }: AutoplayManagerProps) {
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<HTMLAudioElement | null>(null);
  const { isSpeaking } = useAudioStore();

  // オーディオの自動再生を試行し、失敗した場合はユーザーインタラクションを要求
  const tryAutoplay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      await audio.play();
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.warn('Audio autoplay blocked, requiring user interaction');
        setPendingAudio(audio);
        setNeedsInteraction(true);
        return false;
      }
      throw error;
    }
  }, []);

  // ユーザーがタップしたときに保留中の音声を再生
  const handleUserInteraction = useCallback(async () => {
    if (pendingAudio) {
      try {
        await pendingAudio.play();
        setNeedsInteraction(false);
        setPendingAudio(null);
      } catch (error) {
        console.error('Failed to play audio after user interaction:', error);
      }
    } else {
      setNeedsInteraction(false);
    }
  }, [pendingAudio]);

  // グローバルなオーディオ再生要求をリッスン
  useEffect(() => {
    const handleAudioPlayRequest = (event: CustomEvent<HTMLAudioElement>) => {
      tryAutoplay(event.detail);
    };

    window.addEventListener('audioPlayRequest', handleAudioPlayRequest as EventListener);
    return () => {
      window.removeEventListener('audioPlayRequest', handleAudioPlayRequest as EventListener);
    };
  }, [tryAutoplay]);

  // 話しているときに自動再生が必要になる場合の処理
  useEffect(() => {
    if (isSpeaking && !needsInteraction) {
      // 現在話している状態で、自動再生が既に許可されている場合は何もしない
      return;
    }
  }, [isSpeaking, needsInteraction]);

  return (
    <>
      {children}
      
      {/* ユーザーインタラクション要求オーバーレイ */}
      {needsInteraction && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
          onClick={handleUserInteraction}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.783L4.172 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.172l4.211-3.783z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              音声を再生します
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ブラウザの制限により、音声を再生するためにタップが必要です
            </p>
            <button
              onClick={handleUserInteraction}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              タップして音声を再生
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// オーディオ再生要求を送信するヘルパー関数
export function requestAudioPlay(audio: HTMLAudioElement) {
  const event = new CustomEvent('audioPlayRequest', { detail: audio });
  window.dispatchEvent(event);
}
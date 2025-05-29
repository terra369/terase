/**
 * クライアントサイドからサーバーサイドAPIを呼び出す安全な実装
 * OpenAIのAPIキーをブラウザに露出させないセキュアな方法
 */

import { useAudioStore } from '@/stores/useAudioStore';
import { ensureAudioContextRunning } from '@/lib/audioContext';

export async function streamTTS(text: string, onProgress?: (progress: number) => void) {
  try {
    // サーバーサイドAPIエンドポイントを呼び出す
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate speech');
    }

    // 音声データを取得
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    
    // Audio要素を作成して再生
    const audio = new Audio();
    audio.src = URL.createObjectURL(blob);
    
    // 発話状態を更新
    const { setSpeaking } = useAudioStore.getState();
    setSpeaking(true);
    
    // プログレス更新用のタイマー
    let progressInterval: NodeJS.Timeout | null = null;
    
    // 再生のイベントリスナー
    audio.onloadedmetadata = () => {
      if (onProgress && audio.duration) {
        progressInterval = setInterval(() => {
          const progress = (audio.currentTime / audio.duration) * 100;
          onProgress(progress);
        }, 50);
      }
    };
    
    audio.onended = () => {
      setSpeaking(false);
      if (progressInterval) {
        clearInterval(progressInterval);
        onProgress?.(100);
      }
    };
    
    // 再生開始（モバイル対応のフォールバック付き）
    try {
      // AudioContextが正常に動作しているか確認
      await ensureAudioContextRunning();
      await audio.play();
    } catch (error) {
      console.error('Direct audio play failed, trying via AutoplayManager:', error);
      // AutoplayManagerにオーディオ再生要求を送信（モバイル必須）
      const event = new CustomEvent('audioPlayRequest', { detail: audio });
      window.dispatchEvent(event);
      // エラーとして再投げしないでフォールバックに任せる
    }
    
    // コントロール用のオブジェクトを返す
    return {
      audio,
      blob: () => blob,
      stop: () => {
        audio.pause();
        setSpeaking(false);
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      }
    };
  } catch (error) {
    console.error("Error setting up audio stream:", error);
    // エラー時は発話状態をリセット
    const { setSpeaking } = useAudioStore.getState();
    setSpeaking(false);
    throw error;
  }
}
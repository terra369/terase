/**
 * クライアントサイドからサーバーサイドAPIを呼び出す安全な実装
 * OpenAIのAPIキーをブラウザに露出させないセキュアな方法
 */

import { useAudioStore } from '@/stores/useAudioStore';

export async function streamTTS(text: string) {
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
    
    // 再生のイベントリスナー
    audio.onended = () => {
      setSpeaking(false);
    };
    
    // 再生開始
    await audio.play();
    
    // コントロール用のオブジェクトを返す
    return {
      audio,
      blob: () => blob,
      stop: () => {
        audio.pause();
        setSpeaking(false);
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
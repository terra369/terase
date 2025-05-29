/**
 * クライアントサイドからサーバーサイドAPIを呼び出す安全な実装
 * OpenAIのAPIキーをブラウザに露出させないセキュアな方法
 */

import { useAudioStore } from '@/stores/useAudioStore';

const AUDIO_PERMISSION_KEY = 'terase_audio_permission_granted';

function isAudioPermissionGranted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUDIO_PERMISSION_KEY) === 'true';
}

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
    
    // 再生開始（モバイル対応）
    // 既に許可が与えられている場合は直接再生（確認なし）
    if (isAudioPermissionGranted()) {
      try {
        await audio.play();
        // 許可済みなので成功したらそのまま制御オブジェクトを返す
        localStorage.setItem(AUDIO_PERMISSION_KEY, 'true'); // 許可状態を再確認
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
        console.error('Audio play failed despite permission granted:', error);
        // 許可されているはずなのに失敗した場合の処理
        if (error instanceof Error && (['NotAllowedError', 'NotSupportedError'].includes(error.name))) {
          // 明確に許可関連のエラーの場合のみ許可状態をリセット
          console.warn('Permission-related error occurred, resetting permission state');
          localStorage.removeItem(AUDIO_PERMISSION_KEY);
          // AutoplayManagerにオーディオ再生要求を送信
          const event = new CustomEvent('audioPlayRequest', { detail: audio });
          window.dispatchEvent(event);
          // 発話状態は維持（ユーザーがタップするまで待機）
          setSpeaking(true);
        } else {
          // その他のエラー（ネットワークエラーなど）の場合は許可状態は維持し、静かに失敗
          console.warn('Audio playback failed with non-permission error, maintaining permission state');
          setSpeaking(false);
        }
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
      }
    }

    try {
      await audio.play();
      // 初回再生成功時に許可状態を保存
      localStorage.setItem(AUDIO_PERMISSION_KEY, 'true');
    } catch (error) {
      if (error instanceof Error && (['NotAllowedError', 'NotSupportedError', 'AbortError'].includes(error.name))) {
        console.warn('Audio autoplay blocked by browser policy. Requesting user interaction...', error.name);
        // AutoplayManagerにオーディオ再生要求を送信
        const event = new CustomEvent('audioPlayRequest', { detail: audio });
        window.dispatchEvent(event);
        
        // 発話状態は維持（ユーザーがタップするまで待機）
        setSpeaking(true);
      } else {
        throw error;
      }
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
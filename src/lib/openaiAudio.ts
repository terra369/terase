/**
 * クライアントサイドからサーバーサイドAPIを呼び出す安全な実装
 * OpenAIのAPIキーをブラウザに露出させないセキュアな方法
 * 
 * シングルトンAudio要素を使用してモバイルブラウザの自動再生制限を回避
 */

import { useAudioStore } from '@/stores/useAudioStore';
import { ensureAudioContextRunning } from '@/lib/audioContext';
import { 
  isIOS, 
  createIOSAudioElement,
  playAudioWithIOSFallback,
  preloadAudioForIOS 
} from '@/lib/audioUtils';

// シングルトンAudio要素（アプリ全体で再利用）
let globalAudioElement: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

/**
 * グローバルなAudio要素を取得・初期化
 * 初回呼び出し時にAudio要素を作成し、以降は同じ要素を再利用
 */
function getGlobalAudioElement(): HTMLAudioElement {
  if (!globalAudioElement) {
    // iOS判定に基づいて適切なAudio要素を作成
    globalAudioElement = isIOS() 
      ? createIOSAudioElement() // iOS専用の設定でAudio要素作成（src未設定）
      : new Audio();
    
    // iOS以外でも念のため基本属性を設定
    if (!isIOS()) {
      globalAudioElement.setAttribute('playsinline', 'true');
      globalAudioElement.setAttribute('webkit-playsinline', 'true');
    }
    
    // 基本的なイベントリスナーを設定（一度だけ）
    globalAudioElement.addEventListener('error', (e) => {
      // audio.srcが設定されていない場合のエラーは無視（初期化時のみ）
      if (!globalAudioElement?.src || globalAudioElement.src === '' || globalAudioElement.src === 'about:blank') {
        return;
      }
      // エラーの詳細情報を取得
      const error = globalAudioElement.error;
      const errorDetails = error ? `${error.code}: ${error.message}` : 'Unknown error';
      console.error('Global audio element error:', errorDetails, e);
      const { setSpeaking } = useAudioStore.getState();
      setSpeaking(false);
    });
  }
  
  return globalAudioElement;
}

/**
 * 前のBlob URLをクリーンアップ
 */
function cleanupBlobUrl() {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
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
    
    // 前のBlob URLをクリーンアップ
    cleanupBlobUrl();
    
    // 新しいBlob URLを作成
    currentBlobUrl = URL.createObjectURL(blob);
    
    // シングルトンAudio要素を取得
    const audio = getGlobalAudioElement();
    
    // 前の再生を停止（重複再生防止）
    audio.pause();
    audio.currentTime = 0;
    
    // 発話状態を更新とミュート状態の適用
    const { setSpeaking, isMuted } = useAudioStore.getState();
    setSpeaking(true);
    
    // ミュート状態を適用
    audio.muted = isMuted;
    
    // プログレス更新用のタイマー
    let progressInterval: NodeJS.Timeout | null = null;
    
    // 既存のイベントリスナーをクリア（重複防止）
    audio.onloadedmetadata = null;
    audio.onended = null;
    
    // 再生のイベントリスナーを設定
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
        progressInterval = null;
      }
    };
    
    // 新しい音声ソースを設定
    audio.src = currentBlobUrl;
    
    // iOSの場合はpreloadを'auto'に設定
    if (isIOS()) {
      audio.preload = 'auto';
    }
    
    // 再生開始（モバイル対応のフォールバック付き）
    try {
      // AudioContextが正常に動作しているか確認
      await ensureAudioContextRunning();
      
      if (isIOS()) {
        // iOS専用の再生処理
        try {
          await preloadAudioForIOS(audio);
          await playAudioWithIOSFallback(audio);
        } catch (iosError) {
          console.warn('iOS audio playback failed, falling back to AutoplayManager:', iosError);
          // フォールバックとしてAutoplayManagerを使用
          const event = new CustomEvent('audioPlayRequest', { detail: audio });
          window.dispatchEvent(event);
        }
      } else {
        // iOS以外の通常処理
        audio.load();
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Audio load timeout'));
          }, 5000);
          
          const handleCanPlay = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve(undefined);
          };
          
          const handleError = (e: ErrorEvent) => {
            clearTimeout(timeout);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(e);
          };
          
          audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
          audio.addEventListener('error', handleError, { once: true });
        });
        
        await audio.play();
      }
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
        audio.currentTime = 0;
        setSpeaking(false);
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
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

/**
 * ユーザーの操作で音声再生を「アンロック」する
 * 初回のユーザータップ時に呼ばれ、以降の自動再生を可能にする
 */
export async function unlockAudioPlayback(): Promise<boolean> {
  try {
    // グローバルオーディオ要素を取得（初期化される）
    const audio = getGlobalAudioElement();
    
    // AudioContextの許可も取得
    await ensureAudioContextRunning();
    
    // 音声要素の許可を得るため、無音を短時間再生
    const silentBlobUrl = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAA=';
    
    // 現在のソースを保存
    const originalSrc = audio.src;
    const originalMuted = audio.muted;
    const originalVolume = audio.volume;
    
    try {
      // 無音音声で許可を取得
      audio.src = silentBlobUrl;
      audio.muted = false;
      audio.volume = 0.01; // ほぼ聞こえない音量
      
      // iOSの場合は load() を明示的に呼ぶ
      if (isIOS()) {
        audio.load();
        // load完了を待つ
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Audio load timeout during unlock'));
          }, 3000);
          
          const handleCanPlay = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(new Error('Audio load error during unlock'));
          };
          
          audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
          audio.addEventListener('error', handleError, { once: true });
        });
      }
      
      await audio.play();
      
      // 短時間再生後停止
      await new Promise(resolve => setTimeout(resolve, 100));
      audio.pause();
      audio.currentTime = 0;
      
      console.log('Audio playback unlocked successfully');
      return true;
    } catch (playError) {
      console.warn('Audio unlock play failed:', playError);
      // プレイが失敗してもtrue を返す（一度試行したことが重要）
      return true;
    } finally {
      // 元の設定を復元する前に少し待つ（iOS対策）
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 元の設定を復元
      if (originalSrc && originalSrc !== '' && originalSrc !== 'about:blank') {
        audio.src = originalSrc;
      } else {
        // srcが元々空の場合は、空のままにする（about:blankは設定しない）
        audio.removeAttribute('src');
      }
      audio.muted = originalMuted;
      audio.volume = originalVolume || 1.0;
    }
    
  } catch (error) {
    console.error('Failed to unlock audio playback:', error);
    return false;
  }
}

/**
 * グローバルAudio要素のクリーンアップ（必要に応じて）
 */
export function cleanupGlobalAudio() {
  if (globalAudioElement) {
    globalAudioElement.pause();
    globalAudioElement.src = '';
    globalAudioElement = null;
  }
  cleanupBlobUrl();
}
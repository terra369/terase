'use client'
import { useState, useEffect, useCallback } from 'react';
import { UnmuteButton } from '@/components/ui/unmute-button';
import { useAudioStore } from '@/stores/useAudioStore';
import { 
  handleFirstUserInteraction,
  ensureAudioContextRunning
} from '@/lib/audioContext';
import { 
  isIOS, 
  playAudioWithIOSFallback,
  preloadAudioForIOS 
} from '@/lib/audioUtils';


interface AutoplayManagerProps {
  children: React.ReactNode;
}

export function AutoplayManager({ children }: AutoplayManagerProps) {
  const [showUnmuteButton, setShowUnmuteButton] = useState(false);
  const { isMuted, setMuted, hasUserUnmuted, setHasUserUnmuted, isSpeaking } = useAudioStore();
  
  // 音声再生時にミュートボタンを表示
  useEffect(() => {
    if (isSpeaking && isMuted && !hasUserUnmuted) {
      setShowUnmuteButton(true);
    } else if (!isSpeaking || !isMuted || hasUserUnmuted) {
      setShowUnmuteButton(false);
    }
  }, [isSpeaking, isMuted, hasUserUnmuted]);
  
  // ミュート解除処理
  const handleUnmute = useCallback(async () => {
    try {
      // 初回のユーザーインタラクション時にAudioContextを初期化
      await handleFirstUserInteraction();
      
      // AudioContextが動いているか確認
      await ensureAudioContextRunning();
      
      // ミュート解除
      setMuted(false);
      setHasUserUnmuted(true);
      setShowUnmuteButton(false);
      
      // 現在再生中の音声があれば、ミュートを解除して再開
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (!audio.paused && audio.muted) {
          audio.muted = false;
          // iOSの場合は念のため再度play()を呼ぶ
          if (isIOS()) {
            audio.play().catch(console.error);
          }
        }
      });
    } catch (error) {
      console.error('Error unmuting audio:', error);
    }
  }, [setMuted, setHasUserUnmuted]);

  // オーディオの自動再生を試行（モバイル対応強化）
  const tryAutoplay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      // AudioContextが正常に動作しているか確認
      await ensureAudioContextRunning();
      
      // iOS特有の属性を設定（もし設定されていなければ）
      if (!audio.hasAttribute('playsinline')) {
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.setAttribute('x-webkit-airplay', 'allow');
      }
      
      // ミュート状態に応じて音声を設定
      if (isMuted) {
        audio.muted = true;
      } else {
        audio.muted = false;
      }
      
      // iOSの場合は専用の再生ロジックを使用
      if (isIOS()) {
        // iOS専用のプリロードと再生処理
        if (audio.readyState < 3) {
          await preloadAudioForIOS(audio);
        }
        await playAudioWithIOSFallback(audio, 3);
      } else {
        // iOS以外の通常処理
        if (audio.readyState < 4) {
          audio.load();
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Audio load timeout in AutoplayManager'));
            }, 5000);
            
            audio.addEventListener('canplaythrough', () => {
              clearTimeout(timeout);
              resolve(undefined);
            }, { once: true });
            
            audio.addEventListener('error', (e) => {
              clearTimeout(timeout);
              reject(e);
            }, { once: true });
          });
        }
        await audio.play();
      }
      
      return true;
    } catch (error) {
      console.error('Audio play failed in AutoplayManager:', error);
      throw error;
    }
  }, [isMuted]);


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


  return (
    <>
      {/* ミュート解除ボタン */}
      {showUnmuteButton && (
        <UnmuteButton onUnmute={handleUnmute} />
      )}
      
      {children}
    </>
  );
}

// オーディオ再生要求を送信するヘルパー関数
export function requestAudioPlay(audio: HTMLAudioElement) {
  const event = new CustomEvent('audioPlayRequest', { detail: audio });
  window.dispatchEvent(event);
}
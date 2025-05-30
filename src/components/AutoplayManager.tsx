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
import { unlockAudioPlayback } from '@/lib/openaiAudio';


interface AutoplayManagerProps {
  children: React.ReactNode;
}

export function AutoplayManager({ children }: AutoplayManagerProps) {
  const [showUnmuteButton, setShowUnmuteButton] = useState(false);
  const { isMuted, setMuted, setHasUserUnmuted } = useAudioStore();
  
  // Don't show unmute button anymore since we handle consent upfront
  useEffect(() => {
    // Always keep unmute button hidden
    setShowUnmuteButton(false);
  }, []);
  
  // ミュート解除処理（改良版：シングルトンオーディオ対応）
  const handleUnmute = useCallback(async () => {
    try {
      // 初回のユーザーインタラクション時にAudioContextを初期化
      await handleFirstUserInteraction();
      
      // AudioContextが動いているか確認
      await ensureAudioContextRunning();
      
      // シングルトンAudio要素の音声再生許可を取得
      const unlockSuccess = await unlockAudioPlayback();
      
      if (unlockSuccess) {
        console.log('Audio unlock successful via user gesture');
      } else {
        console.warn('Audio unlock failed, falling back to legacy method');
      }
      
      // ミュート解除
      setMuted(false);
      setHasUserUnmuted(true);
      setShowUnmuteButton(false);
    } catch (error) {
      console.error('Error unmuting audio:', error);
    }
  }, [setMuted, setHasUserUnmuted]);

  // オーディオの自動再生を試行（シングルトンAudio対応版）
  const tryAutoplay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      // AudioContextが正常に動作しているか確認
      await ensureAudioContextRunning();
      
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
        }
        await audio.play();
      }
      
      return true;
    } catch (error) {
      console.error('Audio play failed in AutoplayManager:', error);
      
      // NotAllowedErrorの場合でもUnmuteButtonは表示しない
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('Audio blocked by autoplay policy, but consent should have been obtained');
        // Don't show unmute button anymore
      }
      
      throw error;
    }
  }, [isMuted, setShowUnmuteButton]);

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
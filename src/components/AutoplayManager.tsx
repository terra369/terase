'use client'
import { useState, useEffect, useCallback } from 'react';
import { AudioConsentOverlay } from '@/components/ui/audio-consent-overlay';
import { 
  isAudioContextPermissionGranted, 
  handleFirstUserInteraction,
  ensureAudioContextRunning
} from '@/lib/audioContext';


interface AutoplayManagerProps {
  children: React.ReactNode;
}

export function AutoplayManager({ children }: AutoplayManagerProps) {
  const [needsConsent, setNeedsConsent] = useState(false);

  // 初回ロード時に同意が必要かチェック
  useEffect(() => {
    const hasContextPermission = isAudioContextPermissionGranted();
    
    if (!hasContextPermission) {
      setNeedsConsent(true);
    }
  }, []);

  // 初回同意処理
  const handleConsent = useCallback(async () => {
    try {
      // AudioContextの初期化とダミー音声再生
      const success = await handleFirstUserInteraction();
      if (success) {
        setNeedsConsent(false);
      } else {
        console.error('Failed to initialize audio context on consent');
      }
    } catch (error) {
      console.error('Error during consent handling:', error);
    }
  }, []);

  // オーディオの自動再生を試行（初回同意後は常に成功するはず）
  const tryAutoplay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      // AudioContextが正常に動作しているか確認
      await ensureAudioContextRunning();
      await audio.play();
      return true;
    } catch (error) {
      console.error('Audio play failed after consent:', error);
      throw error;
    }
  }, []);


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
      {/* 初回同意オーバーレイ */}
      {needsConsent && (
        <AudioConsentOverlay onConsent={handleConsent} />
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
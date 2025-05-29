'use client'
import { useState, useEffect, useCallback } from 'react';
import { AudioConsentOverlay } from '@/components/ui/audio-consent-overlay';
import { 
  isAudioContextPermissionGranted, 
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
  const [needsConsent, setNeedsConsent] = useState(false);

  // 初回ロード時に同意が必要かチェック
  useEffect(() => {
    // iOS Safariの検出
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const hasContextPermission = isAudioContextPermissionGranted();
    
    // iOSの場合は常に許諾を表示、それ以外は保存された許諾を確認
    if (isIOS || !hasContextPermission) {
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
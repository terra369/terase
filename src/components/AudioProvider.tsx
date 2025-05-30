'use client'
import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import { 
  handleFirstUserInteraction,
  ensureAudioContextRunning,
  isAudioContextPermissionGranted
} from '@/lib/audioContext';
import { isIOS } from '@/lib/audioUtils';
import { UnmuteButton } from '@/components/ui/unmute-button';

interface AudioProviderContext {
  playTTS: (text: string) => Promise<void>;
  playAudioBlob: (blob: Blob) => Promise<void>;
  stop: () => void;
  needsInteraction: boolean;
  audioEnabled: boolean;
  toggleAudioEnabled: () => void;
}

const AudioContext = createContext<AudioProviderContext | null>(null);

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
}

interface AudioProviderProps {
  children: React.ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingBlobRef = useRef<Blob | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(() => {
    // デバッグのため、localStorageをクリア
    if (typeof window !== 'undefined') {
      localStorage.removeItem('terase_audio_context_permission_granted');
    }
    
    const hasPermission = isAudioContextPermissionGranted();
    console.log('[AudioProvider] Initial permission check:', hasPermission);
    console.log('[AudioProvider] Force showing overlay for debugging');
    return true; // 常にオーバーレイを表示
  });
  const [showUnmuteButton, setShowUnmuteButton] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const { 
    isMuted, 
    setMuted, 
    hasUserUnmuted, 
    setHasUserUnmuted, 
    isSpeaking, 
    setSpeaking 
  } = useAudioStore();
  
  useEffect(() => {
    console.log('=== AudioProvider State Update ===');
    console.log('needsInteraction:', needsInteraction);
    console.log('hasUserUnmuted:', hasUserUnmuted);
    console.log('isMuted:', isMuted);
    console.log('audioEnabled:', audioEnabled);
    console.log('showUnmuteButton:', showUnmuteButton);
    console.log('Should show overlay:', needsInteraction && !hasUserUnmuted);
    
    // localStorageの内容も確認
    if (typeof window !== 'undefined') {
      console.log('localStorage permission:', localStorage.getItem('terase_audio_context_permission_granted'));
    }
  }, [needsInteraction, hasUserUnmuted, isMuted, audioEnabled, showUnmuteButton]);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      if ('playsInline' in audio) {
        (audio as HTMLMediaElement & { playsInline?: boolean }).playsInline = true;
      }
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
      audio.preload = 'auto';
      audio.controls = false;
      
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      audio.onerror = (e) => {
        console.error('Audio error:', e);
        setSpeaking(false);
      };
      
      audioRef.current = audio;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [setSpeaking]);

  useEffect(() => {
    console.log('[AudioProvider] Mute state effect:', { isMuted, hasUserUnmuted });
    if (audioRef.current) {
      audioRef.current.muted = isMuted && !hasUserUnmuted;
      console.log('[AudioProvider] Audio element muted state set to:', audioRef.current.muted);
    }
  }, [isMuted, hasUserUnmuted]);

  useEffect(() => {
    const shouldShow = isSpeaking && isMuted && !hasUserUnmuted;
    console.log('[AudioProvider] Unmute button visibility:', { isSpeaking, isMuted, hasUserUnmuted, shouldShow });
    setShowUnmuteButton(shouldShow);
  }, [isSpeaking, isMuted, hasUserUnmuted]);

  const playAudioBlobInternal = useCallback(async (blob: Blob) => {
    if (!audioEnabled || !audioRef.current) return;
    
    const audio = audioRef.current;

    try {
      await ensureAudioContextRunning();
      
      if (audio.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      
      audio.pause();
      audio.src = URL.createObjectURL(blob);
      
      if (isIOS()) {
        audio.load();
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Load timeout')), 5000);
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
      
    } catch (error) {
      console.error('Audio play failed:', error);
      
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setNeedsInteraction(true);
        pendingBlobRef.current = blob;
        setShowUnmuteButton(true);
      }
      
      throw error;
    }
  }, [audioEnabled]);

  const handleUnlock = useCallback(async () => {
    console.log('handleUnlock called');
    try {
      const interactionResult = await handleFirstUserInteraction();
      console.log('handleFirstUserInteraction result:', interactionResult);
      
      const contextRunning = await ensureAudioContextRunning();
      console.log('ensureAudioContextRunning result:', contextRunning);
      
      if (audioRef.current) {
        console.log('audioRef.current exists, attempting to unlock');
        audioRef.current.muted = false;
        
        // 正しいWAVファイルヘッダを作成
        const sampleRate = 44100;
        const numChannels = 1;
        const bitsPerSample = 16;
        const duration = 0.1; // 0.1秒
        const numSamples = Math.floor(sampleRate * duration);
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = numSamples * blockAlign;
        const fileSize = 36 + dataSize;
        
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        
        // RIFFヘッダ
        const encoder = new TextEncoder();
        view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46); // "RIFF"
        view.setUint32(4, fileSize, true);
        view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45); // "WAVE"
        
        // fmtチャンク
        view.setUint8(12, 0x66); view.setUint8(13, 0x6D); view.setUint8(14, 0x74); view.setUint8(15, 0x20); // "fmt "
        view.setUint32(16, 16, true); // fmtチャンクのサイズ
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        
        // dataチャンク
        view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61); // "data"
        view.setUint32(40, dataSize, true);
        
        // 無音データ（すべて0）
        for (let i = 44; i < buffer.byteLength; i++) {
          view.setUint8(i, 0);
        }
        
        const silentBlob = new Blob([buffer], { type: 'audio/wav' });
        audioRef.current.src = URL.createObjectURL(silentBlob);
        
        try {
          await audioRef.current.play();
          audioRef.current.pause();
          console.log('Silent audio played successfully');
        } catch (e) {
          console.warn('Silent audio play failed:', e);
        }
      }
      
      console.log('[handleUnlock] Before state updates:', {
        needsInteraction,
        isMuted,
        hasUserUnmuted
      });
      
      setNeedsInteraction(false);
      setMuted(false);
      setHasUserUnmuted(true);
      
      console.log('[handleUnlock] State updates called - states will update on next render');
      
      // ネットワークタブでAPIコールを確認するためのダミーログ
      console.log('[handleUnlock] Process completed successfully');
      
      if (pendingBlobRef.current) {
        console.log('Playing pending audio blob');
        const blob = pendingBlobRef.current;
        pendingBlobRef.current = null;
        await playAudioBlobInternal(blob);
      }
    } catch (error) {
      console.error('Failed to unlock audio:', error);
    }
  }, [setMuted, setHasUserUnmuted, playAudioBlobInternal]);

  const handleUnmute = useCallback(async () => {
    await handleUnlock();
    setShowUnmuteButton(false);
  }, [handleUnlock]);

  const playAudioBlob = useCallback(async (blob: Blob) => {
    return playAudioBlobInternal(blob);
  }, [playAudioBlobInternal]);

  const playTTS = useCallback(async (text: string) => {
    if (!audioEnabled) return;
    
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      
      await playAudioBlob(blob);
      
    } catch (error) {
      console.error('TTS error:', error);
      setSpeaking(false);
      throw error;
    }
  }, [audioEnabled, playAudioBlob, setSpeaking]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeaking(false);
  }, [setSpeaking]);

  const toggleAudioEnabled = useCallback(() => {
    setAudioEnabled(prev => !prev);
    if (!audioEnabled && audioRef.current) {
      audioRef.current.pause();
    }
  }, [audioEnabled]);

  return (
    <AudioContext.Provider value={{
      playTTS,
      playAudioBlob,
      stop,
      needsInteraction,
      audioEnabled,
      toggleAudioEnabled
    }}>
      {needsInteraction && !hasUserUnmuted && (
        <div 
          className="fixed inset-0 bg-black/20 z-[9999] flex items-center justify-center pointer-events-auto"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm mx-4 relative"
            style={{ pointerEvents: 'auto' }}
          >
            <h3 className="text-lg font-semibold mb-2">音声を有効にする</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              terase の音声機能を使用するには、タップして音声を有効にしてください。
            </p>
            <button 
              className="w-full bg-[#ec6a52] hover:bg-[#e55a40] active:bg-[#d94a30] text-white rounded-lg px-4 py-3 transition-colors cursor-pointer font-medium text-base"
              style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
              onClick={() => {
                console.log('=== Button Click Detected ===');
                console.log('needsInteraction:', needsInteraction);
                console.log('hasUserUnmuted:', hasUserUnmuted);
                console.log('isMuted:', isMuted);
                console.log('audioEnabled:', audioEnabled);
                console.log('Calling handleUnlock...');
                handleUnlock();
              }}
              onMouseDown={(e) => {
                console.log('=== Mouse Down Event ===');
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                console.log('=== Touch Start Event ===');
                e.preventDefault();
              }}
              type="button"
            >
              音声を有効にする
            </button>
          </div>
        </div>
      )}
      
      {showUnmuteButton && (
        <UnmuteButton onUnmute={handleUnmute} />
      )}
      
      {children}
    </AudioContext.Provider>
  );
}
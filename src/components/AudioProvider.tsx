'use client'
import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import { 
  handleFirstUserInteraction,
  ensureAudioContextRunning,
  isAudioContextPermissionGranted
} from '@/lib/audioContext';
import { isIOS, createSilentAudioBlob } from '@/lib/audioUtils';
import { UnmuteButton } from '@/components/ui/unmute-button';
import { logger, handleAudioError } from '@/lib/utils';

interface ExtendedHTMLAudioElement extends HTMLAudioElement {
  playsInline?: boolean;
}

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
    const hasPermission = isAudioContextPermissionGranted();
    return !hasPermission;
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
    logger.log('=== AudioProvider State Update ===');
    logger.log('needsInteraction:', needsInteraction);
    logger.log('hasUserUnmuted:', hasUserUnmuted);
    logger.log('isMuted:', isMuted);
    logger.log('audioEnabled:', audioEnabled);
    logger.log('showUnmuteButton:', showUnmuteButton);
    logger.log('Should show overlay:', needsInteraction && !hasUserUnmuted);
  }, [needsInteraction, hasUserUnmuted, isMuted, audioEnabled, showUnmuteButton]);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      if ('playsInline' in audio) {
        (audio as ExtendedHTMLAudioElement).playsInline = true;
      }
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
      audio.preload = 'auto';
      audio.controls = false;
      
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      audio.onerror = (e) => {
        handleAudioError(e instanceof Error ? e : new Error('Audio element error'), 'AudioProvider');
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
    logger.log('[AudioProvider] Mute state effect:', { isMuted, hasUserUnmuted });
    if (audioRef.current) {
      audioRef.current.muted = isMuted && !hasUserUnmuted;
      logger.log('[AudioProvider] Audio element muted state set to:', audioRef.current.muted);
    }
  }, [isMuted, hasUserUnmuted]);

  useEffect(() => {
    const shouldShow = isSpeaking && isMuted && !hasUserUnmuted;
    logger.log('[AudioProvider] Unmute button visibility:', { isSpeaking, isMuted, hasUserUnmuted, shouldShow });
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
      const audioError = handleAudioError(error instanceof Error ? error : new Error(String(error)), 'playAudioBlobInternal');
      
      if (audioError.type === 'permission') {
        setNeedsInteraction(true);
        pendingBlobRef.current = blob;
        setShowUnmuteButton(true);
      }
      
      throw audioError;
    }
  }, [audioEnabled]);

  const handleUnlock = useCallback(async () => {
    logger.log('handleUnlock called');
    try {
      const interactionResult = await handleFirstUserInteraction();
      logger.log('handleFirstUserInteraction result:', interactionResult);
      
      const contextRunning = await ensureAudioContextRunning();
      logger.log('ensureAudioContextRunning result:', contextRunning);
      
      if (audioRef.current) {
        logger.log('audioRef.current exists, attempting to unlock');
        audioRef.current.muted = false;
        
        const silentBlob = createSilentAudioBlob();
        audioRef.current.src = URL.createObjectURL(silentBlob);
        
        try {
          await audioRef.current.play();
          audioRef.current.pause();
          logger.log('Silent audio played successfully');
        } catch (e) {
          logger.warn('Silent audio play failed:', e);
        }
      }
      
      logger.log('[handleUnlock] Before state updates:', {
        needsInteraction,
        isMuted,
        hasUserUnmuted
      });
      
      setNeedsInteraction(false);
      setMuted(false);
      setHasUserUnmuted(true);
      
      logger.log('[handleUnlock] State updates called - states will update on next render');
      logger.log('[handleUnlock] Process completed successfully');
      
      if (pendingBlobRef.current) {
        logger.log('Playing pending audio blob');
        const blob = pendingBlobRef.current;
        pendingBlobRef.current = null;
        await playAudioBlobInternal(blob);
      }
    } catch (error) {
      handleAudioError(error instanceof Error ? error : new Error(String(error)), 'handleUnlock');
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
      const audioError = handleAudioError(error instanceof Error ? error : new Error(String(error)), 'playTTS');
      setSpeaking(false);
      throw audioError;
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
                logger.log('=== Button Click Detected ===');
                logger.log('needsInteraction:', needsInteraction);
                logger.log('hasUserUnmuted:', hasUserUnmuted);
                logger.log('isMuted:', isMuted);
                logger.log('audioEnabled:', audioEnabled);
                logger.log('Calling handleUnlock...');
                handleUnlock();
              }}
              onMouseDown={(e) => {
                logger.log('=== Mouse Down Event ===');
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                logger.log('=== Touch Start Event ===');
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
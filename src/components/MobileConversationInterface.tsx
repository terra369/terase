'use client'
import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Button } from "@/components/ui/button";
import { Calendar, Mic } from "lucide-react";
import Link from 'next/link';
import { BallBot } from '@/components/BallBot';
import { useRecorder } from '@/components/hooks/useRecorder';
import { useConversation } from '@/components/hooks/useConversation';
import { useTodayDiary } from '@/components/hooks/useTodayDiary';
import { useConversationStore } from '@/stores/useConversationStore';
import { AudioConsentOverlay } from '@/components/ui/audio-consent-overlay';
import { useAudioStore } from '@/stores/useAudioStore';
import { handleFirstUserInteraction } from '@/lib/audioContext';
import { unlockAudioPlayback } from '@/lib/openaiAudio';

export default function MobileConversationInterface() {
  const { recording, start, stop, error: recorderError } = useRecorder();
  const { diaryId } = useTodayDiary();
  const { state, processConversation, startListening, stopConversation } = useConversation(diaryId || undefined);
  const {
    messages,
    setRecording,
    error,
    setError
  } = useConversationStore();
  const { setMuted, setHasUserUnmuted } = useAudioStore();
  
  // Check if user has already consented to audio
  const [showConsent, setShowConsent] = useState(false);
  
  useEffect(() => {
    // Check localStorage for audio consent
    const hasConsented = localStorage.getItem('teraseAudioConsent');
    if (!hasConsented) {
      setShowConsent(true);
    } else {
      // If already consented, initialize audio immediately (with proper error handling)
      const initAudio = async () => {
        try {
          await handleFirstUserInteraction();
          await unlockAudioPlayback();
          setMuted(false);
          setHasUserUnmuted(true);
        } catch (error) {
          console.warn('Auto-initialization of audio failed (expected on page load):', error);
          // Don't show error to user - they can re-initialize by interacting
        }
      };
      initAudio();
    }
  }, [setMuted, setHasUserUnmuted]);
  
  // Combine recorder errors with conversation errors
  const displayError = recorderError || error;

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Handle audio consent
  const handleAudioConsent = async () => {
    try {
      // Initialize audio context and unlock playback
      await handleFirstUserInteraction();
      await unlockAudioPlayback();
      
      // Update audio store state
      setMuted(false);
      setHasUserUnmuted(true);
      
      // Save consent to localStorage
      localStorage.setItem('teraseAudioConsent', 'true');
      
      // Hide consent overlay
      setShowConsent(false);
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      setError('音声の初期化に失敗しました');
    }
  };

  // 録音状態をストアと同期
  React.useEffect(() => {
    setRecording(recording);
  }, [recording, setRecording]);

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // メイン録音ボタンの処理
  const handleToggleRecording = async () => {
    try {
      if (recording) {
        // 録音停止 → 処理開始
        const audioBlob = await stop();
        await processConversation(audioBlob);
      } else {
        // 録音開始
        console.log('Starting recording...');
        startListening();
        await start();
        console.log('Recording started successfully');
      }
    } catch (error) {
      console.error('Recording error:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      const errorMessage = error instanceof Error ? error.message : '録音に失敗しました';
      setError(errorMessage);
      stopConversation();
    }
  };



  const isProcessing = ['transcribing', 'thinking'].includes(state);
  const isSpeaking = state === 'speaking';


  return (
    <>
      {/* Audio consent overlay */}
      {showConsent && (
        <AudioConsentOverlay onConsent={handleAudioConsent} />
      )}
      
      <main className="bg-[#ecedf3] flex flex-row justify-center w-full min-h-screen">
      <div className="bg-[#ecedf3] w-full max-w-[390px] md:max-w-2xl lg:max-w-4xl min-h-screen relative mx-auto">
        {/* App header */}
        <header className="absolute top-[53px] md:top-20 left-0 right-0 flex justify-between items-center px-9 md:px-12">
          <div className="flex-1"></div> {/* Spacer */}
          <h1 className="font-bold text-[#212121] text-[28px] md:text-4xl lg:text-5xl text-center tracking-wider">
            terase
          </h1>
          <div className="flex-1 flex justify-end">
            <Link href="/calendar">
              <Calendar className="w-7 h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 text-[#212121] hover:text-[#212121]/80 transition-colors" />
            </Link>
          </div>
        </header>

        {/* Main 3D bot */}
        <div className="absolute w-[200px] h-[200px] md:w-[300px] md:h-[300px] lg:w-[400px] lg:h-[400px] top-56 md:top-48 lg:top-40 left-1/2 transform -translate-x-1/2">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <BallBot />
          </Canvas>
        </div>


        {/* Recording status text */}
        {recording && (
          <div className="absolute bottom-[180px] md:bottom-[220px] lg:bottom-[280px] left-1/2 transform -translate-x-1/2 font-bold text-[#ec6a52] text-[13px] md:text-base lg:text-lg text-center tracking-[0] leading-normal">
            録音中...
          </div>
        )}

        {/* Processing status text */}
        {(isProcessing || isSpeaking) && !recording && (
          <div className="absolute bottom-[180px] md:bottom-[220px] lg:bottom-[280px] left-1/2 transform -translate-x-1/2 font-bold text-[#ec6a52] text-[13px] md:text-base lg:text-lg text-center tracking-[0] leading-normal">
            {(state === 'transcribing' || state === 'thinking') && 'terase が考え中...'}
            {state === 'speaking' && 'terase が話し始めます...'}
          </div>
        )}

        {/* Microphone button */}
        <div className="absolute bottom-[40px] md:bottom-16 lg:bottom-20 left-0 right-0 flex flex-col items-center gap-3 md:gap-4">
          {/* Container with fixed size to prevent position shift */}
          <div className="w-[122px] h-[122px] md:w-[150px] md:h-[150px] lg:w-[180px] lg:h-[180px] flex items-center justify-center">
            {recording ? (
              // 録音中: 同心円デザイン
              <div className="w-[122px] h-[122px] md:w-[150px] md:h-[150px] lg:w-[180px] lg:h-[180px] bg-[#ec6a5240] rounded-full flex items-center justify-center absolute">
                <div className="w-[94px] h-[94px] md:w-[115px] md:h-[115px] lg:w-[140px] lg:h-[140px] bg-[#ec6a5280] rounded-full flex items-center justify-center">
                  <Button
                    onClick={handleToggleRecording}
                    className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] lg:w-[100px] lg:h-[100px] bg-[#ec6a52] rounded-full hover:bg-[#ec6a52]/90 border-none flex items-center justify-center p-0"
                    size="icon"
                  >
                    <Mic className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white" />
                  </Button>
                </div>
              </div>
            ) : (
              // 非録音時: シンプルなボタン
              <Button
                onClick={handleToggleRecording}
                disabled={isProcessing || isSpeaking}
                className={`w-[72px] h-[72px] md:w-[88px] md:h-[88px] lg:w-[100px] lg:h-[100px] rounded-full flex items-center justify-center transition-colors ${(isProcessing || isSpeaking)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#212121] hover:bg-[#333333]'
                  }`}
                size="icon"
              >
                <Mic className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white" />
              </Button>
            )}
          </div>
        </div>

        {/* Error display */}
        {displayError && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 px-4">
            <div className="bg-red-500 text-white rounded-lg px-4 py-2 shadow-lg max-w-md">
              <div className="flex items-center justify-between">
                <span className="text-sm">{displayError}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-2 text-white hover:text-red-200"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
'use client';

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useEffect } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';

export default function HoldRecLayer() {
  const { start, stop, recording } = useVoiceRecorder();
  
  // AudioStoreと連携して録音状態を反映
  const setSpeaking = useAudioStore(state => state.setSpeaking);
  
  useEffect(() => {
    // 録音状態をオーディオストアに反映
    setSpeaking(recording);
  }, [recording, setSpeaking]);

  return (
    <div
      className="fixed inset-0 z-10"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={e => e.code === 'Space' && start()}
      onKeyUp={e => e.code === 'Space' && stop()}
      role="button"
      aria-label="Hold to talk"
      tabIndex={0}
    >
      {/* ラベル */}
      <p className={`absolute bottom-12 w-full text-center text-lg select-none pointer-events-none
        ${recording ? 'text-red-400' : 'text-gray-300'}`}>
        {recording ? 'Recording…' : 'Hold to talk'}
      </p>
    </div>
  );
}

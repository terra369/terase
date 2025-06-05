import { useCallback } from 'react';
import { useRecorder } from '@/components/hooks/useRecorder';
import { useConversation } from '@/components/hooks/useConversation';
import { useConversationStore } from '@/stores/useConversationStore';
import { ErrorHandler } from '@/lib/errorHandling';

export interface UseRecordingFlowOptions {
  diaryId?: number;
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

export function useRecordingFlow(options: UseRecordingFlowOptions = {}) {
  const { diaryId, onError, onSuccess } = options;
  
  const { recording, start, stop, error: recorderError } = useRecorder();
  const { processConversation, startListening, stopConversation } = useConversation(diaryId);
  const { setLiveTranscript, setError } = useConversationStore();

  const handleToggleRecording = useCallback(async () => {
    try {
      if (recording) {
        // 録音停止＆処理開始
        const audioBlob = await stop();
        await processConversation(audioBlob);
        onSuccess?.();
      } else {
        // 録音開始
        startListening();
        setLiveTranscript('録音中...');
        await start();
      }
    } catch (error) {
      const errorHandler = ErrorHandler.fromUnknown(error, 'recording');
      errorHandler.log();
      
      const errorMessage = errorHandler.getUserMessage();
      setError(errorMessage);
      onError?.(errorMessage);
      
      // エラー時は会話を停止
      stopConversation();
    }
  }, [
    recording, 
    stop, 
    processConversation, 
    start, 
    startListening, 
    setLiveTranscript, 
    stopConversation, 
    setError,
    onError,
    onSuccess
  ]);

  return {
    recording,
    error: recorderError,
    handleToggleRecording,
    isRecording: recording
  };
}
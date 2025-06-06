import { useCallback } from 'react';
import { useConversationStore } from '@/stores/useConversationStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { streamTTS } from '@/lib/openaiAudio';
import { ErrorUtils } from '@/lib/errorHandling';
import { useDiary } from '@/core/hooks/useDiary';

export function useConversation(diaryId?: number) {
  const {
    state,
    setState,
    messages,
    addMessage,
    setLiveTranscript,
    setError,
    setCurrentAudioBlob
  } = useConversationStore();

  const { setSpeaking } = useAudioStore();
  
  // Use centralized diary operations
  const { createDiary, addMessage: addDiaryMessage } = useDiary();

  // Save message to diary_messages table (using centralized useDiary hook)
  const saveMessageToDiary = useCallback(async (diaryId: number, role: 'user' | 'ai', text: string, audioUrl?: string, triggerAI = false) => {
    return addDiaryMessage({
      diaryId,
      role,
      text,
      audioUrl,
      triggerAI
    });
  }, [addDiaryMessage]);

  // Create or get today's diary (using centralized useDiary hook)
  const ensureTodayDiary = useCallback(async (transcript: string, audioPath: string) => {
    const today = new Date().toISOString().slice(0, 10);
    
    return createDiary({
      date: today,
      text: transcript,
      audioPath
    });
  }, [createDiary]);

  // 音声をテキストに変換（音声アップロードも含む）
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<{ transcript: string; audioPath: string }> => {
    setState('transcribing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorDetail = '転写に失敗しました';
        try {
          const errorBody = await response.json();
          console.error('Failed to transcribe audio. API response:', errorBody);
          if (errorBody && errorBody.error) {
            errorDetail = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
          }
        } catch (e) {
          console.error('Failed to parse error response body:', e);
        }
        throw new Error(errorDetail);
      }

      const { transcript, audioPath } = await response.json();
      return { transcript, audioPath };
    } catch (error) {
      const errorHandler = ErrorUtils.transcription(error);
      errorHandler.log();
      setError(errorHandler.getUserMessage());
      setState('idle');
      throw error;
    }
  }, [setState, setError]);

  // AIからの応答を取得
  const getAIResponse = useCallback(async (userMessage: string): Promise<string> => {
    setState('thinking');
    setError(null);

    try {
      // 会話の文脈を作成（最近の5つのメッセージ）
      const context = messages.slice(-4).map(msg => ({
        role: msg.speaker === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage,
          context
        })
      });

      if (!response.ok) {
        let errorDetail = 'AI応答の生成に失敗しました';
        try {
          const errorBody = await response.json();
          console.error('Failed to get AI response. API response:', errorBody);
          if (errorBody && errorBody.error) {
            errorDetail = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
          }
        } catch (e) {
          console.error('Failed to parse error response body:', e);
        }
        throw new Error(errorDetail);
      }

      const { response: aiResponse } = await response.json();
      return aiResponse;
    } catch (error) {
      const errorHandler = ErrorUtils.ai(error);
      errorHandler.log();
      setError(errorHandler.getUserMessage());
      setState('idle');
      throw error;
    }
  }, [messages, setState, setError]);

  // AIの応答を音声で再生
  const speakAIResponse = useCallback(async (text: string): Promise<void> => {
    setState('speaking');
    setSpeaking(true);
    setError(null);

    try {
      await streamTTS(text, () => {
        // Progress callback removed as we're not tracking it anymore
      });
      
    } catch (error) {
      const errorHandler = ErrorUtils.tts(error);
      errorHandler.log();
      
      // 自動再生がブロックされた場合はエラーとして表示しない
      if (!(error instanceof Error && error.message.includes('自動再生がブロックされました'))) {
        setError(errorHandler.getUserMessage());
      }
    } finally {
      setState('idle');
      setSpeaking(false);
    }
  }, [setState, setSpeaking, setError]);

  // 完全な会話フロー：録音 → 転写 → diary保存 → AI応答 → 音声再生
  const processConversation = useCallback(async (audioBlob: Blob) => {
    try {
      setCurrentAudioBlob(audioBlob);

      // 1. 転写と音声アップロード
      const { transcript, audioPath } = await transcribeAudio(audioBlob);
      
      // ユーザーメッセージをローカルに追加
      addMessage({
        content: transcript,
        speaker: 'user'
      });

      // リアルタイム表示をクリア
      setLiveTranscript('');

      // 2. 日記エントリーの作成/取得
      let currentDiaryId = diaryId;
      if (!currentDiaryId) {
        currentDiaryId = await ensureTodayDiary(transcript, audioPath);
      } else {
        // 既存の日記にユーザーメッセージを保存（AIレスポンスはDBトリガーで自動生成される）
        await saveMessageToDiary(currentDiaryId, 'user', transcript, audioPath, false);
      }

      // 3. AI応答の取得
      const aiResponse = await getAIResponse(transcript);

      // AIメッセージをローカルに追加
      addMessage({
        content: aiResponse,
        speaker: 'ai'
      });

      // 4. AI応答を音声で再生
      await speakAIResponse(aiResponse);

    } catch (error) {
      console.error('Conversation processing error:', error);
      let errorMessage = '会話の処理に失敗しました';
      
      if (error instanceof Error) {
        if (error.message.includes('getUserMedia')) {
          errorMessage = 'マイクへのアクセスが拒否されました。ブラウザの設定でマイクを許可してください。';
        } else if (error.message.includes('MediaRecorder')) {
          errorMessage = 'このブラウザでは音声録音がサポートされていません。別のブラウザをお試しください。';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else {
          errorMessage = `エラー: ${error.message}`;
        }
      }
      
      setError(errorMessage);
      setState('idle');
    } finally {
      setCurrentAudioBlob(null);
    }
  }, [
    diaryId,
    setCurrentAudioBlob,
    transcribeAudio,
    addMessage,
    setLiveTranscript,
    ensureTodayDiary,
    saveMessageToDiary,
    getAIResponse,
    speakAIResponse,
    setState,
    setError
  ]);

  // 会話を開始
  const startListening = useCallback(() => {
    setState('listening');
    setError(null);
    setLiveTranscript('');
  }, [setState, setError, setLiveTranscript]);

  // 会話を停止
  const stopConversation = useCallback(() => {
    setState('idle');
    setSpeaking(false);
    setCurrentAudioBlob(null);
  }, [setState, setSpeaking, setCurrentAudioBlob]);

  return {
    state,
    messages,
    processConversation,
    startListening,
    stopConversation,
    isActive: state !== 'idle'
  };
}
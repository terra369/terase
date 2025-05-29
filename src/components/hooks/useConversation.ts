import { useCallback } from 'react';
import { useConversationStore } from '@/stores/useConversationStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { streamTTS } from '@/lib/openaiAudio';

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

  // Save message to diary_messages table
  const saveMessageToDiary = useCallback(async (diaryId: number, role: 'user' | 'ai', text: string, audioUrl?: string, triggerAI = false) => {
    try {
      const response = await fetch('/api/diaries/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          diaryId,
          role,
          text,
          audioUrl: audioUrl || null,
          triggerAI
        })
      });

      if (!response.ok) {
        let errorDetail = 'メッセージの保存に失敗しました';
        try {
          const errorBody = await response.json();
          console.error('Failed to save message. API response:', errorBody);
          if (errorBody && errorBody.error) {
            errorDetail = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
          }
        } catch (e) {
          console.error('Failed to parse error response body:', e);
        }
        throw new Error(errorDetail);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving message to diary:', error);
      throw error;
    }
  }, []);

  // Create or get today's diary
  const ensureTodayDiary = useCallback(async (transcript: string, audioPath: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      
      const response = await fetch('/api/actions/saveDiary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: today,
          text: transcript,
          audioPath
        })
      });

      if (!response.ok) {
        let errorDetail = '日記の作成に失敗しました';
        try {
          const errorBody = await response.json();
          console.error('Failed to create diary. API response:', errorBody);
          if (errorBody && errorBody.error) {
            errorDetail = typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody.error);
          }
        } catch (e) {
          console.error('Failed to parse error response body:', e);
        }
        throw new Error(errorDetail);
      }

      const { diaryId: newDiaryId } = await response.json();
      return newDiaryId;
    } catch (error) {
      console.error('Error creating diary:', error);
      throw error;
    }
  }, []);

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
      console.error('Transcription error:', error);
      const errorMessage = error instanceof Error ? error.message : '音声の文字起こしに失敗しました';
      setError(`文字起こしエラー: ${errorMessage}`);
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
      console.error('AI response error:', error);
      const errorMessage = error instanceof Error ? error.message : 'AI応答の生成に失敗しました';
      setError(`AI応答エラー: ${errorMessage}`);
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
      console.error('TTS error:', error);
      const errorMessage = error instanceof Error ? error.message : '音声の再生に失敗しました';
      
      // 自動再生がブロックされた場合はエラーとして表示しない
      if (!(error instanceof Error && error.message.includes('自動再生がブロックされました'))) {
        setError(`音声再生エラー: ${errorMessage}`);
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
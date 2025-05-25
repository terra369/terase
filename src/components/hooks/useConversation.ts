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
        throw new Error('メッセージの保存に失敗しました');
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
        throw new Error('日記の作成に失敗しました');
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
        throw new Error('転写に失敗しました');
      }

      const { transcript, audioPath } = await response.json();
      return { transcript, audioPath };
    } catch (error) {
      console.error('Transcription error:', error);
      setError('音声の文字起こしに失敗しました');
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
        throw new Error('AI応答の生成に失敗しました');
      }

      const { response: aiResponse } = await response.json();
      return aiResponse;
    } catch (error) {
      console.error('AI response error:', error);
      setError('AI応答の生成に失敗しました');
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
      await streamTTS(text);
    } catch (error) {
      console.error('TTS error:', error);
      setError('音声の再生に失敗しました');
      setSpeaking(false);
    } finally {
      setState('idle');
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
      setError('会話の処理に失敗しました');
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
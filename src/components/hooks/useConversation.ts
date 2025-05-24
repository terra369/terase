import { useCallback } from 'react';
import { useConversationStore } from '@/stores/useConversationStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { streamTTS } from '@/lib/openaiAudio';

export function useConversation() {
  const {
    state,
    setState,
    messages,
    addMessage,
    updateMessage,
    setLiveTranscript,
    setError,
    currentAudioBlob,
    setCurrentAudioBlob
  } = useConversationStore();

  const { setSpeaking } = useAudioStore();

  // 音声をテキストに変換
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string> => {
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

      const { transcript } = await response.json();
      return transcript;
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

  // 完全な会話フロー：録音 → 転写 → AI応答 → 音声再生
  const processConversation = useCallback(async (audioBlob: Blob) => {
    try {
      setCurrentAudioBlob(audioBlob);

      // 1. 転写
      const transcript = await transcribeAudio(audioBlob);
      
      // ユーザーメッセージを追加
      addMessage({
        content: transcript,
        speaker: 'user'
      });

      // リアルタイム表示をクリア
      setLiveTranscript('');

      // 2. AI応答生成
      const aiResponse = await getAIResponse(transcript);
      
      // AIメッセージを追加
      addMessage({
        content: aiResponse,
        speaker: 'ai'
      });

      // 3. 音声再生
      await speakAIResponse(aiResponse);

    } catch (error) {
      console.error('Conversation processing error:', error);
      // エラーは各関数内で設定済み
    } finally {
      setCurrentAudioBlob(null);
    }
  }, [
    setCurrentAudioBlob,
    transcribeAudio,
    addMessage,
    setLiveTranscript,
    getAIResponse,
    speakAIResponse
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
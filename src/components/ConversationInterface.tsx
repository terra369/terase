'use client'
import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Link from 'next/link';
import { BallBot } from '@/components/BallBot';
import { useRecorder } from '@/components/hooks/useRecorder';
import { useConversation } from '@/components/hooks/useConversation';
import { useConversationStore } from '@/stores/useConversationStore';
import { useAudioStore } from '@/stores/useAudioStore';
import ConversationTranscript from '@/components/ConversationTranscript';

export default function ConversationInterface() {
  const { recording, start, stop } = useRecorder();
  const { state, processConversation, startListening, stopConversation } = useConversation();
  const { setRecording, setLiveTranscript, error, setError } = useConversationStore();
  const { isSpeaking } = useAudioStore();
  
  const [isInitialized, setIsInitialized] = useState(false);

  // 録音状態をストアと同期
  useEffect(() => {
    setRecording(recording);
  }, [recording, setRecording]);

  // メイン録音ボタンの処理
  const handleToggleRecording = async () => {
    try {
      if (recording) {
        // 録音停止 → 処理開始
        const audioBlob = await stop();
        await processConversation(audioBlob);
      } else {
        // 録音開始
        startListening();
        setLiveTranscript('録音中...');
        await start();
      }
    } catch (error) {
      console.error('Recording error:', error);
      setError('録音に失敗しました');
      stopConversation();
    }
  };

  // 強制停止
  const handleForceStop = () => {
    if (recording) {
      stop().catch(console.error);
    }
    stopConversation();
    setLiveTranscript('');
  };

  // エラークリア
  const clearError = () => setError(null);

  // 初期化
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">初期化中...</p>
        </div>
      </div>
    );
  }

  const isActive = state !== 'idle';
  const isProcessing = ['transcribing', 'thinking'].includes(state);

  return (
    <div className="relative h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* 3D ボット表示 */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <BallBot />
        </Canvas>
      </div>

      {/* ナビゲーション */}
      <div className="absolute top-4 left-4 z-10">
        <Link 
          href="/calendar"
          className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-colors"
        >
          📅 カレンダー
        </Link>
      </div>

      {/* 状態表示 */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-white dark:bg-gray-800 rounded-full px-6 py-3 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            {/* 状態インジケーター */}
            <div className={`w-3 h-3 rounded-full ${
              state === 'idle' ? 'bg-gray-400' :
              state === 'listening' ? 'bg-red-500 animate-pulse' :
              state === 'transcribing' ? 'bg-yellow-500 animate-pulse' :
              state === 'thinking' ? 'bg-blue-500 animate-pulse' :
              state === 'speaking' ? 'bg-green-500 animate-pulse' :
              'bg-gray-400'
            }`}></div>
            
            {/* 状態テキスト */}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {state === 'idle' && '待機中'}
              {state === 'listening' && '録音中...'}
              {state === 'transcribing' && '文字起こし中...'}
              {state === 'thinking' && 'AI が考え中...'}
              {state === 'speaking' && 'AI が話し中...'}
            </span>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-red-500 text-white rounded-lg px-4 py-2 shadow-lg max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-sm">{error}</span>
              <button
                onClick={clearError}
                className="ml-2 text-white hover:text-red-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メイン操作エリア */}
      <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
        <div className="flex flex-col items-center space-y-6">
          
          {/* 録音ボタン */}
          <button
            onClick={handleToggleRecording}
            disabled={isProcessing || isSpeaking}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
              recording
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : isActive || isSpeaking
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {recording ? (
              <div className="w-8 h-8 bg-white rounded-sm"></div>
            ) : (
              <div className="w-0 h-0 border-l-[16px] border-t-[12px] border-b-[12px] border-l-white border-t-transparent border-b-transparent ml-1"></div>
            )}
          </button>

          {/* コントロールボタン */}
          <div className="flex space-x-4">
            {/* 強制停止ボタン */}
            {isActive && (
              <button
                onClick={handleForceStop}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                停止
              </button>
            )}
          </div>

          {/* 操作説明 */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {state === 'idle' && 'ボタンを押して話しかけてください'}
              {state === 'listening' && 'お話しください...'}
              {state === 'transcribing' && '音声を文字に変換しています...'}
              {state === 'thinking' && 'AI が応答を考えています...'}
              {state === 'speaking' && 'AI が話しています...'}
            </p>
          </div>
        </div>
      </div>

      {/* 会話履歴 */}
      <ConversationTranscript />
    </div>
  );
}
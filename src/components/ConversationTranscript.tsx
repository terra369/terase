'use client'
import { useConversationStore } from '@/stores/useConversationStore';
import { useAudioStore } from '@/stores/useAudioStore';

export default function ConversationTranscript() {
  const { 
    messages, 
    liveTranscript, 
    state, 
    showTranscript, 
    toggleTranscript 
  } = useConversationStore();
  
  const { isSpeaking } = useAudioStore();

  if (!showTranscript) {
    return (
      <button
        onClick={toggleTranscript}
        className="fixed bottom-4 right-4 p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors z-10"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 max-h-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-10">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">会話履歴</h3>
        <button
          onClick={toggleTranscript}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* メッセージリスト */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-72">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-2 rounded-lg ${
                message.speaker === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <span className="text-xs opacity-70">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

        {/* リアルタイム文字起こし */}
        {liveTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[70%] p-2 rounded-lg bg-blue-400 text-white opacity-80">
              <p className="text-sm">{liveTranscript}</p>
              <span className="text-xs opacity-70">入力中...</span>
            </div>
          </div>
        )}

        {/* 状態表示 */}
        {(state === 'transcribing' || state === 'thinking' || isSpeaking) && (
          <div className="flex justify-start">
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-600">
              <div className="flex items-center space-x-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {state === 'transcribing' && '文字起こし中...'}
                  {state === 'thinking' && 'AI が考え中...'}
                  {isSpeaking && 'AI が話し中...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
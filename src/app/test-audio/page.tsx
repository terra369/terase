'use client'
import { useAudio } from '@/components/AudioProvider';
import { useState } from 'react';

export default function TestAudioPage() {
  const { playTTS, audioEnabled, toggleAudioEnabled, needsInteraction } = useAudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testAudio = async () => {
    try {
      setIsPlaying(true);
      setError(null);
      await playTTS('こんにちは！terase の音声テストです。正常に聞こえていますか？');
    } catch (err) {
      setError(err instanceof Error ? err.message : '音声再生に失敗しました');
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6">音声再生テスト</h1>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
            <span>音声機能</span>
            <button
              onClick={toggleAudioEnabled}
              className={`px-4 py-2 rounded ${audioEnabled ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
            >
              {audioEnabled ? '有効' : '無効'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
            <span>ユーザー操作が必要</span>
            <span className={needsInteraction ? 'text-red-500' : 'text-green-500'}>
              {needsInteraction ? 'はい' : 'いいえ'}
            </span>
          </div>

          <button
            onClick={testAudio}
            disabled={!audioEnabled || isPlaying}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
          >
            {isPlaying ? '再生中...' : '音声をテスト'}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              エラー: {error}
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded">
          <h2 className="font-semibold mb-2">テスト手順:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>「音声をテスト」ボタンをタップ</li>
            <li>初回は音声許可のポップアップが表示されます</li>
            <li>「音声を有効にする」をタップ</li>
            <li>再度「音声をテスト」ボタンをタップ</li>
            <li>音声が再生されることを確認</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
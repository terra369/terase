'use client'
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Mic } from "lucide-react";
import Link from 'next/link';
import { useRecorder } from '@/components/hooks/useRecorder';
import { useConversation } from '@/components/hooks/useConversation';
import { useTodayDiary } from '@/components/hooks/useTodayDiary';
import { useConversationStore } from '@/stores/useConversationStore';

export default function MobileConversationInterface() {
  const { recording, start, stop } = useRecorder();
  const { diaryId } = useTodayDiary();
  const { state, processConversation, startListening, stopConversation } = useConversation(diaryId || undefined);
  const { 
    messages, 
    liveTranscript, 
    setRecording, 
    setLiveTranscript, 
    error, 
    setError 
  } = useConversationStore();

  // 録音状態をストアと同期
  React.useEffect(() => {
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

  // グリーティングテキストのデータ（非録音時）
  const greetingLines = [
    { text: "こんにちはteraseです。", opacity: "text-[#2121211a]" },
    { text: "今日はどんな一日でしたか？", opacity: "text-[#21212140]" },
    { text: "一緒に振り返りましょう。", opacity: "text-[#212121]" },
  ];

  // 会話データ（録音中時）
  const getConversationData = () => {
    const conversationMessages = [];
    
    // 最新のメッセージから最大4つを取得
    if (messages.length > 0) {
      const recentMessages = messages.slice(-4);
      recentMessages.forEach((msg, index) => {
        const opacity = index === recentMessages.length - 1 ? 'opacity-100' : 
                       index === recentMessages.length - 2 ? 'opacity-50' : 
                       index === recentMessages.length - 3 ? 'opacity-25' : 'opacity-10';
        
        conversationMessages.push({
          text: msg.content.length > 20 ? msg.content.substring(0, 20) + '...' : msg.content,
          opacity,
          speaker: msg.speaker
        });
      });
    }

    // ライブ文字起こしがある場合は追加
    if (liveTranscript && liveTranscript !== '録音中...') {
      conversationMessages.push({
        text: liveTranscript.length > 20 ? liveTranscript.substring(0, 20) + '...' : liveTranscript,
        opacity: 'opacity-100',
        speaker: 'user'
      });
    }

    // デフォルトメッセージで埋める（会話がない場合）
    if (conversationMessages.length === 0) {
      return [
        { text: "今日はどんな一日でしたか？", opacity: "opacity-25", speaker: 'ai' },
        { text: "一緒に振り返りましょう。", opacity: "opacity-50", speaker: 'ai' },
        { text: "よろしくお願いします。", opacity: "opacity-75", speaker: 'ai' },
        { text: "今日は友だちと遊びました。", opacity: "opacity-100", speaker: 'user' },
      ];
    }

    return conversationMessages.slice(-4); // 最大4つまで
  };

  const conversationData = getConversationData();
  const isRecordingOrActive = recording || state !== 'idle';
  const isProcessing = ['transcribing', 'thinking'].includes(state);

  return (
    <main className="bg-[#ecedf3] flex flex-row justify-center w-full min-h-screen">
      <div className="bg-[#ecedf3] w-full max-w-[390px] min-h-screen relative">
        {/* App header */}
        <header className="absolute top-[53px] left-0 right-0 flex justify-between items-center px-9">
          <div className="flex-1"></div> {/* Spacer */}
          <h1 className="font-bold text-[#212121] text-[28px] text-center tracking-wider">
            terase
          </h1>
          <div className="flex-1 flex justify-end">
            <Link href="/calendar">
              <Calendar className="w-7 h-7 text-[#212121] hover:text-[#212121]/80 transition-colors" />
            </Link>
          </div>
        </header>

        {/* Main image/graphic */}
        <div className="absolute w-[200px] h-[200px] top-56 left-1/2 transform -translate-x-1/2">
          <div className="relative w-[200px] h-[200px]">
            <img
              className="w-full h-full object-contain"
              alt="terase AI companion sphere"
              src="/terase-bot-placeholder.svg"
            />
          </div>
        </div>

        {/* Conversation content */}
        {!isRecordingOrActive ? (
          // 非録音時: グリーティングテキスト
          <Card className="absolute w-[306px] top-[447px] left-9 border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              <p className="font-bold text-[23px] tracking-[0] leading-[34px]">
                {greetingLines.map((line, index) => (
                  <React.Fragment key={index}>
                    <span className={line.opacity}>{line.text}</span>
                    {index < greetingLines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            </CardContent>
          </Card>
        ) : (
          // 録音中または処理中: 会話履歴
          <>
            {/* AIメッセージ（左側） */}
            <div className="absolute w-[306px] top-[447px] left-9 space-y-1">
              {conversationData
                .filter(item => item.speaker === 'ai')
                .slice(0, 2)
                .map((item, index) => (
                  <p
                    key={index}
                    className={`text-[#212121] ${item.opacity} text-[23px] leading-[34px] font-bold tracking-[0]`}
                  >
                    {item.text}
                  </p>
                ))}
            </div>

            {/* ユーザーメッセージ（右側） */}
            <div className="absolute w-[306px] top-[531px] left-12 space-y-1 text-right">
              {conversationData
                .filter(item => item.speaker === 'user')
                .slice(-2)
                .map((item, index) => (
                  <p
                    key={index}
                    className={`text-[#212121] ${item.opacity} text-[23px] leading-[34px] font-bold tracking-[0]`}
                  >
                    {item.text}
                  </p>
                ))}
            </div>
          </>
        )}

        {/* Recording status text */}
        {recording && (
          <div className="absolute top-[656px] left-[170px] font-bold text-[#ec6a52] text-[13px] text-center tracking-[0] leading-normal">
            録音中...
          </div>
        )}

        {/* Processing status text */}
        {isProcessing && !recording && (
          <div className="absolute top-[656px] left-1/2 transform -translate-x-1/2 font-bold text-[#ec6a52] text-[13px] text-center tracking-[0] leading-normal">
            {state === 'transcribing' && '文字起こし中...'}
            {state === 'thinking' && 'AI が考え中...'}
          </div>
        )}

        {/* Microphone button */}
        <div className="absolute bottom-[72px] left-0 right-0 flex flex-col items-center gap-3">
          {recording ? (
            // 録音中: 同心円デザイン
            <div className="w-[122px] h-[122px] bg-[#ec6a5240] rounded-[61px] flex items-center justify-center">
              <div className="w-[94px] h-[94px] bg-[#ec6a5280] rounded-[47px] flex items-center justify-center">
                <Button
                  onClick={handleToggleRecording}
                  className="w-[72px] h-[72px] bg-[#ec6a52] rounded-[36px] hover:bg-[#ec6a52]/90 border-none flex items-center justify-center p-0"
                  size="icon"
                >
                  <Mic className="w-8 h-8 text-white" />
                </Button>
              </div>
            </div>
          ) : (
            // 非録音時: シンプルなボタン
            <Button
              onClick={handleToggleRecording}
              disabled={isProcessing}
              className={`w-[72px] h-[72px] rounded-[36px] flex items-center justify-center transition-all hover:scale-105 ${
                isProcessing 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-[#212121] hover:bg-[#333333]'
              }`}
              size="icon"
            >
              <Mic className="w-8 h-8 text-white" />
            </Button>
          )}
          
          <span className="font-bold text-[#14142b] text-[13px] text-center tracking-[0] leading-[normal]">
            {recording ? 'タップで停止' : '長押しで録音'}
          </span>
        </div>

        {/* Error display */}
        {error && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 px-4">
            <div className="bg-red-500 text-white rounded-lg px-4 py-2 shadow-lg max-w-md">
              <div className="flex items-center justify-between">
                <span className="text-sm">{error}</span>
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
  );
}
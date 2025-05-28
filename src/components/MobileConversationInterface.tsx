'use client'
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Mic } from "lucide-react";
import React from "react";
import Link from 'next/link';
import { BallBot } from '@/components/BallBot';
import { useRecorder } from '@/components/hooks/useRecorder';
import { useConversation } from '@/components/hooks/useConversation';
import { useTodayDiary } from '@/components/hooks/useTodayDiary';
import { useConversationStore } from '@/stores/useConversationStore';

export default function MobileConversationInterface(): JSX.Element {
  const { recording, start, stop } = useRecorder();
  const { diaryId } = useTodayDiary();
  const { state, processConversation, startListening, stopConversation } = useConversation(diaryId || undefined);
  const { setRecording, setLiveTranscript, error, setError, messages } = useConversationStore();

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

  // 最新の会話メッセージを取得（最大4件）
  const recentMessages = messages.slice(-4);

  // データの作成
  const greetingLines = [
    { text: "こんにちはteraseです。", opacity: "text-[#2121211a]" },
    { text: "今日はどんな一日でしたか？", opacity: "text-[#21212140]" },
    { text: "一緒に振り返りましょう。", opacity: "text-[#212121]" },
  ];

  const isRecordingOrActive = recording || state !== 'idle';

  return (
    <main className="bg-[#ecedf3] flex flex-row justify-center w-full">
      <div className="bg-[#ecedf3] w-[390px] h-[844px] relative">
        {/* App header */}
        <header className="absolute top-[53px] left-0 right-0 flex justify-between items-center px-9">
          <div className="flex-1"></div> {/* Spacer */}
          <h1 className="[font-family:'Bakbak_One-Regular',Helvetica] font-normal text-[#212121] text-[28px] text-center">
            terase
          </h1>
          <div className="flex-1 flex justify-end">
            <Link href="/calendar">
              <Calendar className="w-7 h-7 text-[#212121]" />
            </Link>
          </div>
        </header>

        {/* 3D BallBot instead of static image */}
        <div className="absolute w-[200px] h-[200px] top-56 left-[95px]">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <BallBot />
          </Canvas>
        </div>

        {/* Conditional content based on recording state */}
        {!isRecordingOrActive ? (
          /* Greeting text when not recording */
          <Card className="absolute w-[306px] top-[447px] left-9 border-none shadow-none">
            <CardContent className="p-0">
              <p className="[font-family:'SF_Pro_Text-Bold',Helvetica] font-bold text-[23px] tracking-[0] leading-[34px]">
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
          /* Conversation history when recording/active */
          <>
            {recentMessages.length > 0 && (
              <>
                {/* AI messages (left aligned) */}
                <div className="absolute w-[306px] top-[447px] left-9 space-y-1">
                  {recentMessages
                    .filter(msg => msg.role === 'ai')
                    .slice(0, 2)
                    .map((msg, index) => (
                      <p
                        key={index}
                        className={`text-[#212121] text-[23px] leading-[34px] [font-family:'SF_Pro_Text-Bold',Helvetica] font-bold tracking-[0] ${
                          index === 0 ? 'opacity-20' : 'opacity-60'
                        }`}
                      >
                        {msg.text}
                      </p>
                    ))}
                </div>

                {/* User messages (right aligned) */}
                <div className="absolute w-[306px] top-[531px] left-12 space-y-1 text-right">
                  {recentMessages
                    .filter(msg => msg.role === 'user')
                    .slice(0, 2)
                    .map((msg, index) => (
                      <p
                        key={index}
                        className={`text-[#212121] text-[23px] leading-[34px] [font-family:'SF_Pro_Text-Bold',Helvetica] font-bold tracking-[0] ${
                          index === 0 ? 'opacity-60' : 'opacity-100'
                        }`}
                      >
                        {msg.text}
                      </p>
                    ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="absolute top-[620px] left-1/2 transform -translate-x-1/2 bg-red-500 text-white rounded-lg px-4 py-2 text-sm max-w-[300px] text-center">
            {error}
          </div>
        )}

        {/* Recording status text */}
        {isRecordingOrActive && (
          <div className="absolute top-[656px] left-[170px] [font-family:'SF_Pro_Text-Bold',Helvetica] font-bold text-[#ec6a52] text-[13px] text-center tracking-[0] leading-normal">
            {state === 'listening' && '録音中...'}
            {state === 'transcribing' && '文字起こし中...'}
            {state === 'thinking' && 'AI が考え中...'}
            {state === 'speaking' && 'AI が話し中...'}
          </div>
        )}

        {/* Microphone button */}
        <div className="absolute bottom-[72px] left-0 right-0 flex flex-col items-center gap-3">
          {isRecordingOrActive ? (
            /* Recording button with concentric circles */
            <div className="w-[122px] h-[122px] bg-[#ec6a5240] rounded-[61px] flex items-center justify-center">
              <div className="w-[94px] h-[94px] bg-[#ec6a5280] rounded-[47px] flex items-center justify-center">
                <Button
                  onClick={handleToggleRecording}
                  className="w-[72px] h-[72px] bg-[#ec6a52] rounded-[36px] hover:bg-[#d55a42] border-none flex items-center justify-center p-0"
                  size="icon"
                >
                  <Mic className="w-8 h-8 text-white" />
                </Button>
              </div>
            </div>
          ) : (
            /* Normal button */
            <Button
              onClick={handleToggleRecording}
              className="w-[72px] h-[72px] bg-[#212121] rounded-[36px] flex items-center justify-center hover:bg-[#333333]"
              size="icon"
            >
              <Mic className="w-8 h-8 text-white" />
            </Button>
          )}
          
          {!isRecordingOrActive && (
            <span className="[font-family:'SF_Pro_Text-Bold',Helvetica] font-bold text-[#14142b] text-[13px] text-center tracking-[0] leading-[normal]">
              長押しで録音
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
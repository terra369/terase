'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useDiaryRealtime } from '@/lib/useDiaryRealtime';
import { Canvas } from '@react-three/fiber';
import BallBot from '@/components/BallBot';
import { useAudioReactive } from '@/components/hooks/useAudioReactive';

type Msg = {
    id: number;
    role: 'user' | 'ai';
    text: string;
    audio_url: string | null;
    signed?: string | null;
    created_at: string;
    diary_id?: number; // 日記IDを追加
};

// Simple HUD Toast component for notifications
// 現在は使用していないため後で必要になったら使う
/* 
const HUDToast = () => (
    <div className="bg-blue-900/80 text-blue-100 p-3 rounded-lg border border-blue-400/50 backdrop-blur-sm fixed top-4 right-4 z-50">
        <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <p>AI is processing a deep response...</p>
        </div>
    </div>
);
*/

// Chat input component
const ChatInput = ({ onSend }: { onSend: (text: string) => Promise<void> }) => {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSend(message.trim());
            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex space-x-2 mt-4">
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="メッセージを入力..."
                className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
            />
            <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-md text-white ${isSubmitting ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
                {isSubmitting ? '送信中...' : '送信'}
            </button>
        </form>
    );
};

// 音声再生コンポーネント（BallBotと連動する）
const AudioPlayerWithReactive = ({ src }: { src: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const { setupExistingAudio } = useAudioReactive();
    
    useEffect(() => {
        if (audioRef.current) {
            // 音声要素をセットアップ
            setupExistingAudio(audioRef.current);
        }
    }, [setupExistingAudio]);
    
    return <audio ref={audioRef} controls src={src} className="w-full mt-1" />;
};

export default function DiaryDetailClient(
    { diaryId, initialMsgs }: { diaryId: number; initialMsgs: Msg[] },
) {
    const [messages, setMessages] = useState<Msg[]>(initialMsgs);
    const { speak } = useAudioReactive();

    /* メッセージを追加し、署名付きURLを生成する */
    const handleInsert = useCallback(async (m: Msg) => {
        console.log('[デバッグ] 受信したメッセージ:', m);
        
        // audio_urlが存在する場合、署名付きURLを生成する
        if (m.audio_url && !m.signed) {
            console.log('[デバッグ] 音声URLが存在します:', m.audio_url);
            
            try {
                let relativePath = '';
                
                // 完全なURLから相対パスを抽出
                if (m.audio_url.startsWith('http')) {
                    console.log('[デバッグ] 完全URLです');
                    
                    try {
                        // URLをパース
                        const url = new URL(m.audio_url);
                        console.log('[デバッグ] URLパス:', url.pathname);
                        
                        const pathSegments = url.pathname.split('/');
                        console.log('[デバッグ] パスセグメント:', pathSegments);
                        
                        // 方法その1: "diary-audio" を探す
                        const bucketIndex = pathSegments.indexOf('diary-audio');
                        console.log('[デバッグ] "diary-audio"のインデックス:', bucketIndex);
                        
                        if (bucketIndex !== -1 && bucketIndex + 1 < pathSegments.length) {
                            relativePath = pathSegments.slice(bucketIndex + 1).join('/');
                            console.log('[デバッグ] 抽出された相対パス:', relativePath);
                        } else {
                            console.log('[デバッグ] バケット名が見つかりません');
                            
                            // 方法その2: "public" で代替検索
                            const publicIndex = pathSegments.indexOf('public');
                            if (publicIndex !== -1 && publicIndex + 1 < pathSegments.length) {
                                relativePath = pathSegments.slice(publicIndex + 1).join('/');
                                console.log('[デバッグ] "public"以降のパス:', relativePath);
                            }
                            
                            // 方法その3: パターン検索 - ai/83/123456789.mp3 形式を探す
                            if (!relativePath) {
                                const match = url.pathname.match(/ai\/\d+\/\d+\.mp3/);
                                if (match) {
                                    relativePath = match[0];
                                    console.log('[デバッグ] パターンマッチ:', relativePath);
                                }
                            }
                            
                            // 方法その4: ファイル名のみを取得
                            if (!relativePath) {
                                const lastSegment = pathSegments[pathSegments.length - 1];
                                if (lastSegment && lastSegment.endsWith('.mp3')) {
                                    // ディレクトリ構造を推測
                                    if (m.role === 'ai') {
                                        // 日記IDはコンポーネントから渡されたものを使用
                                        relativePath = `ai/${diaryId}/${lastSegment}`;
                                        console.log('[デバッグ] 推測パス(diaryId使用):', relativePath);
                                        
                                        // 安全のためにメッセージにもdiary_idをセット
                                        m.diary_id = diaryId;
                                    }
                                }
                            }
                        }
                    } catch (parseError) {
                        console.error('[デバッグ] URL解析エラー:', parseError);
                    }
                } else {
                    // 直接相対パスを使用
                    relativePath = m.audio_url;
                    console.log('[デバッグ] 直接相対パスを使用:', relativePath);
                }
                
                // 相対パスが抽出できた場合は署名付きURLを生成
                if (relativePath) {
                    console.log('[デバッグ] 署名付きURL生成開始 - バケット=diary-audio, パス=', relativePath);
                    
                    const { data: signedUrlData, error: signedUrlError } = await supabaseBrowser.storage
                        .from('diary-audio')
                        .createSignedUrl(relativePath, 3600); // 1時間有効
                    
                    if (signedUrlError) {
                        console.error('[デバッグ] 署名付きURL生成エラー:', signedUrlError);
                        m.signed = m.audio_url;
                    } else if (signedUrlData?.signedUrl) {
                        m.signed = signedUrlData.signedUrl;
                        console.log('[デバッグ] 署名付きURL生成成功:', m.signed.substring(0, 50) + '...');
                    } else {
                        console.log('[デバッグ] 署名付きURL生成レスポンスが空です');
                        m.signed = m.audio_url;
                    }
                } else {
                    console.log('[デバッグ] 相対パスを抽出できませんでした - 生のURLを使用します');
                    m.signed = m.audio_url;
                }
            } catch (error) {
                console.error('[デバッグ] 署名付きURL生成中のエラー:', error);
                // エラー時は元のURLを使用
                m.signed = m.audio_url;
            }
        } else if (m.signed) {
            console.log('[デバッグ] すでに署名付きURLが存在します:', m.signed.substring(0, 50) + '...');
        }
        
        setMessages((prev) => [...prev, m]);
    }, []);

    /* 送信処理 */
    const handleSend = async (text: string) => {
        // Add user message to the UI immediately
        const tempUserMsg: Msg = {
            id: Date.now(),
            role: 'user',
            text,
            audio_url: null,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMsg]);

        try {
            console.log(`AI返答をリクエスト中...`);
            
            // Send to AI function - 新しい形式に合わせてリクエストを変更
            const response = await fetch("/api/functions/v1/ai_reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    record: { 
                        text, 
                        diary_id: diaryId, 
                        role: 'user' 
                    } 
                })
            });
            
            if (!response.ok) {
                throw new Error(`AI返答APIエラー: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`AI返答を受信:`, data);

            // Speak the reply - data.textを使用するように変更
            if (data?.text) {
                await speak(data.text);
            }
            
            // 音声URLが含まれていれば反映されるはずだが、
            // useDiaryRealtimeで自動的にリアルタイム更新されない場合は、
            // ここで手動でメッセージを追加することも検討できます
        } catch (error) {
            console.error('AI返答を取得中にエラーが発生しました:', error);
            // エラー通知を表示
            const errorToast = document.createElement('div');
            errorToast.innerHTML = `エラー: AI返答を取得できませんでした`;
            errorToast.className = 'bg-red-900/80 text-red-100 p-3 rounded-lg fixed top-4 right-4 z-50';
            document.body.appendChild(errorToast);
            setTimeout(() => errorToast.remove(), 5000);
        }
        
        // Deep broadcast channelはもう不要 (レスポンスが一本化されたため)
    };

    useDiaryRealtime(diaryId, handleInsert);

    return (
        <div className="space-y-4 relative">
            {/* 3D Visualization */}
            <div className="h-60 w-full rounded-lg overflow-hidden mb-4 border border-blue-100 dark:border-blue-900 shadow-md">
                <Canvas camera={{ position: [0, 0, 3] }}>
                    <Suspense fallback={null}>
                        <BallBot />
                        {/* eslint-disable-next-line react/no-unknown-property */}
                        <ambientLight intensity={0.4} />
                    </Suspense>
                </Canvas>
            </div>

            {/* Chat messages */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto p-2">
                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`p-3 rounded-lg ${m.role === 'ai'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-4'
                            : 'bg-gray-50 dark:bg-gray-800/30 mr-4'}`}
                    >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        {/* 音声再生 - 署名付きURLがあればそれを使用し、なければ直接audio_urlを使用 */}
                        {(m.signed || m.audio_url) && (
                            <AudioPlayerWithReactive src={m.signed || m.audio_url || ''} />
                        )}
                    </div>
                ))}
            </div>

            {/* Chat input */}
            <ChatInput onSend={handleSend} />
        </div>
    );
}
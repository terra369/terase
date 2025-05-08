import { useState, useRef, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

// コールバック関数の型定義
type AudioCompleteCallback = (blob: Blob) => void;

export function useVoiceRecorder(onAudioComplete?: AudioCompleteCallback) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 録音を開始する
  const start = useCallback(async () => {
    try {
      // すでに録音中なら何もしない
      if (recording) return;

      // マイクへのアクセス許可を取得
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // MediaRecorderを初期化（opus codec指定）
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      // データが利用可能になったときのイベントハンドラ
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      // 録音停止時のハンドラ
      mediaRecorder.onstop = () => {
        // 録音データからBlobを作成
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(blob);
        // ストリームのトラックを停止
        stream.getTracks().forEach(track => track.stop());
        
        // 外部コールバックが指定されていたら呼び出す
        if (onAudioComplete) {
          onAudioComplete(blob);
        } else {
          // 従来の動作：Supabaseに保存
          upload(blob);
        }
        
        // 状態をリセット
        chunksRef.current = [];
        setRecording(false);
      };
      
      // 録音開始
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch (error) {
      console.error('録音の開始に失敗しました:', error);
    }
  }, [recording, onAudioComplete]);

  // 録音を停止する
  const stop = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  }, [recording]);
  
  // 録音データをアップロードする
  const upload = async (blob: Blob) => {
    try {
      // Supabaseクライアントは定数なので関数呼び出しではなく直接参照
      const supabase = supabaseBrowser;
      
      // ファイル名を生成（タイムスタンプを含む）
      const fileName = `voice_${Date.now()}.webm`;
      
      // Supabaseにアップロード
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(fileName, blob);
        
      if (error) {
        throw error;
      }
      
      console.log('音声アップロード成功:', data);
      
      // TODO: ここでAI処理の呼び出しやナビゲーションなどの追加処理
      
    } catch (error) {
      console.error('音声アップロードに失敗しました:', error);
    }
  };

  return {
    recording,
    audioBlob,
    start,
    stop
  };
}

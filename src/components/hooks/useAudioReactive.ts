import { useState, useRef, useEffect } from "react";
import { streamTTS } from "@/lib/openaiAudio";
import { useAudioStore } from "@/stores/useAudioStore";

export function useAudioReactive() {
  const { setAmp, setSpeaking } = useAudioStore.getState();
  const [ready, setReady] = useState(false);
  const animationRef = useRef<number | null>(null);
  
  // 新しい音声を生成して再生
  const speak = async (text: string) => {
    try {
      // OpenAIに音声生成を依頼
      const { audio } = await streamTTS(text);
      
      // 音声の状態モニタリングをシンプルに設定
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      audio.onpause = () => setSpeaking(false);
      
      // BallBot用のアニメーションを追加
      simulateAudioActivity();
      
      setReady(true);
      return audio;
    } catch (error) {
      console.error("Error in speak function:", error);
      setSpeaking(false);
      return null;
    }
  };
  
  // 既存のオーディオ要素をセットアップ
  const setupExistingAudio = (audioElement: HTMLAudioElement) => {
    audioElement.onplay = () => {
      setSpeaking(true);
      simulateAudioActivity();
    };
    audioElement.onpause = () => setSpeaking(false);
    audioElement.onended = () => setSpeaking(false);
  };
  
  // BallBot用の音声振幅をシミュレート
  // Web Audio APIを使わずに操作するように修正
  const simulateAudioActivity = () => {
    // 以前のアニメーションを消す
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    const animate = () => {
      // 音声の振幅をシミュレート・擬似
      const store = useAudioStore.getState();
      
      if (store.isSpeaking) {
        // 0.1〜0.4の間で振幅をシミュレート
        const simulatedAmp = 0.1 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.3;
        setAmp(simulatedAmp);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setAmp(0);
      }
    };
    
    animate();
  };
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setSpeaking(false);
      setAmp(0);
    };
  }, []);
  
  return { speak, ready, setupExistingAudio };
}

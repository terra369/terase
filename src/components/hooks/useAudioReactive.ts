import { useState, useRef, useEffect } from "react";
import { streamTTS } from "@/lib/openaiAudio";
import { useAudioStore } from "@/stores/useAudioStore";

// 文章の抑揚を分析するのに役立つパターン（拡張版）
const QUESTION_PATTERNS = [
  // ---- 英語 ----
  /\?\s*$/,
  /^(who|what|when|where|why|how|which|whose)\b/i,
  /^(is|are|am|was|were|do|does|did|can|could|will|would|should)\b/i,

  // ---- 日本語：終助詞・助動詞 ----
  /か[？?]$/,
  /かな[？?]?$/,
  /かい[？?]?$/,
  /かしら[？?]?$/,
  /の[？?]$/,
  /なの[？?]?$/,
  /だろうか[？?]?$/,
  /ますか[？?]?$/,
  /ですか[？?]?$/,
  /[？?]\s*$/,

  // ---- 日本語：疑問詞 ----
  /^(なに|なん|なぜ|なんで|どうして|どう|いくら|いくつ|いかが|いつ|だれ|どこ|どれ|どの|どのくらい|どれくらい|どちら|どっち)\b/i,
];

const EMPHASIS_PATTERNS = [
  // ---- 記号 ----
  /[!！]+$/,
  /[!！?？]{2,}$/,
  // ---- 英語強調語 ----
  /\b(very|really|absolutely|definitely|extremely|super|totally|seriously|incredibly|insanely|unbelievably|awesome|amazing|fantastic|phenomenal)\b/i,
  // ---- 日本語：強調副詞・スラング ----
  /(すごい|すごく|とても|非常に|かなり|めちゃくちゃ|めっちゃ|超|ちょう|マジ|まじで|ガチで|クソ|鬼|激|ほんとに|本当に|絶対に|確実に|やばい)/,
  // ---- 日本語：終助詞による強調 ----
  /[よねぞぜさわな]{1}[!！]?$/,
  /(だよ|だね|だよね|ですよ|ですね|だぞ|だぜ|ださ)[!！]?$/,
  // ---- 感嘆詞 ----
  /(わあ|うわぁ?|やった|すげぇ?|すごっ|うそ|まじかよ|ほんとだ|ええっ|えっ!?|おおお?)/,
];

export function useAudioReactive() {
  const [ready, setReady] = useState(false);
  const animationRef = useRef<number | null>(null);
  const sentencePatternRef = useRef<{
    words: string[];
    currentWordIndex: number;
    patternType: 'normal' | 'question' | 'emphasis';
    startTime: number;
    isJapanese?: boolean;
    audioDuration?: number; // 音声の長さ（ミリ秒）
    wordTimings?: number[]; // 各単語の開始時間（ミリ秒）
    lastUpdateTime?: number; // 最後に更新した時間
  } | null>(null);
  
  // 文章の抑揚を分析しパターンを生成
  const analyzeTextIntonation = (text: string) => {
    // 言語を推定（簡易的な実装）
    const isJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(text);
    
    // 文章を単語に分ける
    let words: string[] = [];
    if (isJapanese) {
      // 日本語の場合は文字単位でもいいが、より良い体験のため簡易的な区切りを使用
      // 句読点、空白、記号などで分割
      words = text.split(/([、。！？!?　\s]+)/).filter(w => w.trim().length > 0);
      // あまりに短い単語が多すぎる場合は、文字単位に分割
      if (words.length < 3 && text.length > 10) {
        // 文字単位で分割するが、ある程度まとめる（3〜5文字ごと）
        const chars = Array.from(text);
        const groupSize = Math.max(3, Math.min(5, Math.floor(chars.length / 5)));
        words = [];
        for (let i = 0; i < chars.length; i += groupSize) {
          words.push(chars.slice(i, i + groupSize).join(''));
        }
      }
    } else {
      // 英語などの場合は空白で分割
      words = text.split(/\s+/).filter(w => w.length > 0);
    }
    
    // 文章の抑揚タイプを判定
    let patternType: 'normal' | 'question' | 'emphasis' = 'normal';
    
    // 質問のパターンかチェック
    if (QUESTION_PATTERNS.some(pattern => pattern.test(text))) {
      patternType = 'question';
    }
    // 強調のパターンかチェック
    else if (EMPHASIS_PATTERNS.some(pattern => pattern.test(text))) {
      patternType = 'emphasis';
    }
    
    return {
      words,
      patternType,
      currentWordIndex: 0,
      startTime: Date.now(),
      isJapanese
    };
  };
  
  // 音声の長さから単語ごとのタイミングを推定する関数
  const estimateWordTimings = (words: string[], audioDuration: number, isJapanese: boolean): number[] => {
    // 単語がない場合は空配列を返す
    if (!words.length) return [];
    
    // 日本語と英語で文字ごとの想定発声時間を変える
    const avgCharTimeMs = isJapanese ? 150 : 80; // 日本語は文字あたり約150ms、英語は約80ms
    
    // 各単語の文字数を数える（空白や句読点を除く）
    const charCounts = words.map(word => {
      // 実際の発音文字だけをカウント（空白や記号は除く）
      return word.replace(/[\s,.!?。、！？]+/g, '').length || 1; // 最低でも1文字としてカウント
    });
    
    // 文字数の合計
    const totalChars = charCounts.reduce((sum, count) => sum + count, 0);
    
    // 想定される総時間（各単語の文字数に基づく）
    const estimatedTotalTime = totalChars * avgCharTimeMs;
    
    // 実際の音声時間に合わせて調整係数を計算
    const adjustmentFactor = audioDuration / estimatedTotalTime;
    
    // 各単語の開始時間を計算
    const wordTimings: number[] = [];
    let currentTime = 0;
    
    for (let i = 0; i < words.length; i++) {
      wordTimings.push(currentTime);
      
      // 日本語の場合は、抑揚に応じて単語の長さを調整
      let wordDuration = charCounts[i] * avgCharTimeMs * adjustmentFactor;
      
      // 文の位置に基づく調整（文末に近づくほど長く発音される傾向）
      const positionFactor = i / (words.length - 1);
      if (sentencePatternRef.current?.patternType === 'question') {
        // 質問文の場合、文末に近いほど長くなる
        wordDuration *= (1 + positionFactor * 0.5);
      } else if (sentencePatternRef.current?.patternType === 'emphasis') {
        // 強調文の場合、強調したい部分が長くなる
        wordDuration *= (1 + Math.sin(positionFactor * Math.PI) * 0.5);
      }
      
      currentTime += wordDuration;
    }
    
    return wordTimings;
  };

  // 新しい音声を生成して再生
  const speak = async (text: string) => {
    try {
      // テキストの抑揚を分析
      const textAnalysis = analyzeTextIntonation(text);
      sentencePatternRef.current = textAnalysis;
      
      // OpenAIに音声生成を依頼
      const { audio } = await streamTTS(text);
      const store = useAudioStore.getState();
      
      // 音声データが利用可能になった時の処理
      audio.onloadedmetadata = () => {
        if (sentencePatternRef.current && audio.duration) {
          // 音声の長さを記録（秒からミリ秒に変換）
          const audioDuration = audio.duration * 1000;
          
          // 単語ごとのタイミングを推定
          const wordTimings = estimateWordTimings(
            sentencePatternRef.current.words,
            audioDuration,
            !!sentencePatternRef.current.isJapanese
          );
          
          // 参照を更新
          sentencePatternRef.current.audioDuration = audioDuration;
          sentencePatternRef.current.wordTimings = wordTimings;
          
          // ストアにも単語情報を設定
          store.setSpeechProgress({
            words: sentencePatternRef.current.words,
            currentWordIndex: 0,
            currentWord: sentencePatternRef.current.words[0] || null,
            progress: 0,
            wordEmphasis: 0,
            isJapanese: !!sentencePatternRef.current.isJapanese
          });
        }
      };
      
      // 音声の状態モニタリングを設定
      audio.onplay = () => {
        store.setSpeaking(true);
        store.setIntonation(sentencePatternRef.current?.patternType || 'normal');
        
        // 再生開始時間を記録
        if (sentencePatternRef.current) {
          sentencePatternRef.current.startTime = Date.now();
          sentencePatternRef.current.lastUpdateTime = Date.now();
        }
        
        // 単語進行のアニメーションを開始
        trackWordProgress();
      };
      
      audio.onended = () => {
        store.setSpeaking(false);
        store.setIntonation('normal');
        sentencePatternRef.current = null;
        
        // 最後の状態をリセット
        store.setSpeechProgress({
          words: [],
          currentWordIndex: 0,
          currentWord: null,
          progress: 0,
          wordEmphasis: 0,
          isJapanese: false
        });
      };
      
      audio.onpause = () => {
        store.setSpeaking(false);
        store.setIntonation('normal');
      };
      
      // 抑揚に基づいたアニメーションを追加
      simulateIntonationBasedActivity();
      
      setReady(true);
      return audio;
    } catch (error) {
      console.error("Error in speak function:", error);
      useAudioStore.getState().setSpeaking(false);
      return null;
    }
  };
  
  // 単語の進行状況を追跡する関数
  const trackWordProgress = () => {
    // 関連データがない場合は処理しない
    if (!sentencePatternRef.current || 
        !sentencePatternRef.current.wordTimings || 
        !sentencePatternRef.current.words.length || 
        !sentencePatternRef.current.audioDuration) {
      return;
    }
    
    const pattern = sentencePatternRef.current;
    const store = useAudioStore.getState();
    
    // 現在の経過時間を計算
    const currentTime = Date.now();
    const elapsedTime = currentTime - pattern.startTime;
    
    // 前回の更新から100ms以上経過していない場合はスキップ（パフォーマンス向上）
    if (pattern.lastUpdateTime && currentTime - pattern.lastUpdateTime < 100) {
      // 別のタイミングで再実行するようにスケジュール
      requestAnimationFrame(trackWordProgress);
      return;
    }
    
    // 最後の更新時間を記録
    pattern.lastUpdateTime = currentTime;
    
    // 音声の再生が終了しているかチェック
    if (elapsedTime >= (pattern.audioDuration || 0)) {
      return;
    }
    
    // 現在再生中の単語を特定
    const wordTimings = pattern.wordTimings || [];
    let currentWordIndex = 0;
    
    // 経過時間よりも後に開始する最初の単語を見つける
    for (let i = 0; i < wordTimings.length; i++) {
      if (i === wordTimings.length - 1 || (wordTimings[i] <= elapsedTime && (i === wordTimings.length - 1 || wordTimings[i + 1] > elapsedTime))) {
        currentWordIndex = i;
        break;
      }
    }
    
    // 単語インデックスが変わった場合のみ更新（パフォーマンス向上）
    if (currentWordIndex !== pattern.currentWordIndex) {
      pattern.currentWordIndex = currentWordIndex;
      
      // ストアの状態を更新
      store.updateWordIndex(currentWordIndex);
    }
    
    // 全体の進行度を更新
    const progress = Math.min(1, elapsedTime / (pattern.audioDuration || 1));
    store.setSpeechProgress({
      progress
    });
    
    // まだ再生中なら次フレームでも実行
    if (store.isSpeaking && progress < 1) {
      requestAnimationFrame(trackWordProgress);
    }
  };

  // 既存のオーディオ要素をセットアップ
  const setupExistingAudio = (audioElement: HTMLAudioElement) => {
    // データ属性からテキストを取得できればパターンを分析
    const textContent = audioElement.dataset.textContent;
    if (textContent) {
      const textAnalysis = analyzeTextIntonation(textContent);
      sentencePatternRef.current = textAnalysis;
      
      // 音声の長さがわかったら単語のタイミングを計算
      audioElement.onloadedmetadata = () => {
        if (sentencePatternRef.current && audioElement.duration) {
          // 音声の長さを記録（秒からミリ秒に変換）
          const audioDuration = audioElement.duration * 1000;
          
          // 単語ごとのタイミングを推定
          const wordTimings = estimateWordTimings(
            sentencePatternRef.current.words,
            audioDuration,
            !!sentencePatternRef.current.isJapanese
          );
          
          // 参照を更新
          sentencePatternRef.current.audioDuration = audioDuration;
          sentencePatternRef.current.wordTimings = wordTimings;
          
          // ストアにも単語情報を設定
          const store = useAudioStore.getState();
          store.setSpeechProgress({
            words: sentencePatternRef.current.words,
            currentWordIndex: 0,
            currentWord: sentencePatternRef.current.words[0] || null,
            progress: 0,
            wordEmphasis: 0,
            isJapanese: !!sentencePatternRef.current.isJapanese
          });
        }
      };
    }
    
    const store = useAudioStore.getState();
    
    audioElement.onplay = () => {
      store.setSpeaking(true);
      if (sentencePatternRef.current) {
        store.setIntonation(sentencePatternRef.current.patternType);
        
        // 再生開始時間を記録
        sentencePatternRef.current.startTime = Date.now();
        sentencePatternRef.current.lastUpdateTime = Date.now();
      }
      
      // 単語進行のトラッキングを開始
      trackWordProgress();
      
      // 抑揚に基づいたアニメーションも追加
      simulateIntonationBasedActivity();
    };
    
    audioElement.onpause = () => {
      store.setSpeaking(false);
      store.setIntonation('normal');
    };
    
    audioElement.onended = () => {
      store.setSpeaking(false);
      store.setIntonation('normal');
      sentencePatternRef.current = null;
      
      // 最後の状態をリセット
      store.setSpeechProgress({
        words: [],
        currentWordIndex: 0,
        currentWord: null,
        progress: 0,
        wordEmphasis: 0,
        isJapanese: false
      });
    };
  };
  
  // 抑揚に基づいた音声アニメーションをシミュレート
  const simulateIntonationBasedActivity = () => {
    // 以前のアニメーションを消す
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // 開始時間を記録
    const startTime = Date.now();
    let lastTime = startTime;
    
    const animate = () => {
      const currentTime = Date.now();
      // const deltaTime = currentTime - lastTime; // 現在未使用
      lastTime = currentTime;
      
      // ストアを取得
      const store = useAudioStore.getState();
      
      if (store.isSpeaking) {
        const pattern = sentencePatternRef.current;
        const elapsedTime = currentTime - startTime;
        
        // 日本語か英語かで基本的なパラメータを調整
        const isJapanese = pattern?.isJapanese || false;
        
        // 単語の進行状況を取得
        const currentWordInfo = store.speechProgress;
        const currentWordEmphasis = currentWordInfo.wordEmphasis || 0;
        
        // 抑揚タイプに応じたアニメーションパラメーター
        let baseAmp = isJapanese ? 0.18 : 0.15; // 日本語は少し大きめの基本振幅
        let freqMod = isJapanese ? 0.008 : 0.01; // 日本語はやや落ち着いた周波数
        let pitchValue = 0.5; // ピッチ値
        
        // 現在の単語に基づく動きの強調
        // 単語の強調度を反映
        const wordEmphasisBoost = currentWordEmphasis * 0.5; // 単語強調による増幅（0～0.5）
        
        // テキストパターンに基づいて動きを変える
        switch (store.intonation) {
          case 'question':
            if (isJapanese) {
              // 日本語の質問は最後に急上昇する傾向
              const progress = currentWordInfo.progress || Math.min(elapsedTime / 2000, 1.0); // 進行状況を使用
              pitchValue = 0.5 + 0.35 * progress + wordEmphasisBoost * 0.15; // 日本語はより上昇する
              baseAmp = 0.15 + 0.12 * progress + wordEmphasisBoost * 0.1;
              // 日本語の質問は周波数が急激に変化
              freqMod = 0.008 + 0.008 * Math.pow(progress, 2) + wordEmphasisBoost * 0.005;
            } else {
              // 英語の質問は比較的なだらかに上昇
              const progress = currentWordInfo.progress || Math.min(elapsedTime / 2000, 1.0);
              pitchValue = 0.5 + 0.3 * progress + wordEmphasisBoost * 0.15;
              baseAmp = 0.15 + 0.1 * progress + wordEmphasisBoost * 0.08;
              freqMod = 0.01 + 0.005 * progress + wordEmphasisBoost * 0.003;
            }
            break;
          
          case 'emphasis':
            if (isJapanese) {
              // 日本語の強調はリズミカルな動き
              baseAmp = 0.28 + wordEmphasisBoost * 0.15; // より大きい
              freqMod = 0.018 + wordEmphasisBoost * 0.008;
              // 日本語の強調は波のような抑揚
              pitchValue = 0.65 + 0.25 * Math.sin(elapsedTime * 0.006) + wordEmphasisBoost * 0.2;
              
              // 単語のリズムをより強調（特に強調文の場合）
              if (currentWordInfo.currentWord) {
                // 現在の単語に応じた追加の動き
                const wordPulse = Math.sin(elapsedTime * (0.01 + wordEmphasisBoost * 0.01));
                baseAmp += Math.abs(wordPulse) * wordEmphasisBoost * 0.2;
              }
            } else {
              // 英語の強調
              baseAmp = 0.25 + wordEmphasisBoost * 0.12;
              freqMod = 0.02 + wordEmphasisBoost * 0.005;
              pitchValue = 0.6 + 0.2 * Math.sin(elapsedTime * 0.005) + wordEmphasisBoost * 0.15;
              
              // 単語のリズムをより強調（特に強調文の場合）
              if (currentWordInfo.currentWord) {
                // 現在の単語に応じた追加の動き
                const wordPulse = Math.sin(elapsedTime * (0.008 + wordEmphasisBoost * 0.008));
                baseAmp += Math.abs(wordPulse) * wordEmphasisBoost * 0.15;
              }
            }
            break;
            
          default: // normal
            if (isJapanese) {
              // 日本語の通常パターンは比較的穏やかな揺れ
              baseAmp = 0.16 + 0.04 * Math.sin(elapsedTime * 0.0008) + wordEmphasisBoost * 0.05;
              pitchValue = 0.5 + 0.08 * Math.sin(elapsedTime * 0.0015) + wordEmphasisBoost * 0.1;
              
              // 単語ごとの微細な動き
              if (currentWordInfo.currentWord) {
                const wordPulse = Math.sin(elapsedTime * 0.004 + currentWordInfo.currentWordIndex * 0.5);
                baseAmp += Math.abs(wordPulse) * wordEmphasisBoost * 0.08;
              }
            } else {
              // 英語の通常パターン
              baseAmp = 0.15 + 0.05 * Math.sin(elapsedTime * 0.001) + wordEmphasisBoost * 0.04;
              pitchValue = 0.5 + 0.1 * Math.sin(elapsedTime * 0.002) + wordEmphasisBoost * 0.08;
              
              // 単語ごとの微細な動き
              if (currentWordInfo.currentWord) {
                const wordPulse = Math.sin(elapsedTime * 0.003 + currentWordInfo.currentWordIndex * 0.4);
                baseAmp += Math.abs(wordPulse) * wordEmphasisBoost * 0.06;
              }
            }
            break;
        }
        
        // 言葉のリズムをシミュレート
        const wordPulse = Math.sin(elapsedTime * freqMod);
        const ampValue = baseAmp + Math.abs(wordPulse) * 0.15;
        
        // ストアを更新
        store.setAmp(ampValue);
        store.setFeatures({
          amp: ampValue,
          voicePitch: pitchValue,
          energyChange: Math.abs(wordPulse),
          // 各周波数帯の値も設定（抑揚に応じて変化）
          lowFreq: 0.1 + 0.2 * Math.abs(Math.sin(elapsedTime * 0.003)),
          midFreq: 0.2 + 0.3 * Math.abs(Math.sin(elapsedTime * 0.006)),
          highFreq: pitchValue * 0.5
        });
        
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // 話していない場合はリセット
        store.setAmp(0);
        store.setFeatures({
          amp: 0,
          lowFreq: 0,
          midFreq: 0,
          highFreq: 0,
          voicePitch: 0.5,
          energyChange: 0
        });
      }
    };
    
    animate();
  };
  
  // 引き続き使えるように実装を残す
  // const simulateAudioActivity = simulateIntonationBasedActivity; // 現在未使用
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      const store = useAudioStore.getState();
      store.setSpeaking(false);
      store.setAmp(0);
      store.setIntonation('normal');
      store.setFeatures({
        amp: 0,
        lowFreq: 0,
        midFreq: 0,
        highFreq: 0,
        voicePitch: 0.5,
        energyChange: 0
      });
    };
  }, []);
  
  return { speak, ready, setupExistingAudio };
}

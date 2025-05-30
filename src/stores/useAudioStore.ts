import { create } from 'zustand';

// 音声分析の詳細な特性を格納する型
type AudioFeatures = {
  amp: number;          // 全体の音量（振幅）
  lowFreq: number;      // 低周波数の強さ
  midFreq: number;      // 中周波数の強さ
  highFreq: number;     // 高周波数の強さ
  voicePitch: number;   // 声のピッチ（高さ）
  energyChange: number; // エネルギー変化率
}

// 文章の進行状況の型
type SpeechProgress = {
  words: string[];            // 読み上げる単語一覧
  currentWordIndex: number;   // 現在の単語インデックス
  progress: number;           // 全体の進行度（0～1）
  currentWord: string | null; // 現在読み上げている単語
  wordEmphasis: number;       // 現在の単語の強調度（0～1）
  isJapanese: boolean;        // 日本語かどうか
}

type AudioStore = {
  // 基本的な音声状態
  amp: number;
  setAmp: (amp: number) => void;
  isSpeaking: boolean;  // AIが話しているかどうかの状態
  setSpeaking: (isSpeaking: boolean) => void;
  
  // 音声特性の詳細
  features: AudioFeatures;
  setFeatures: (features: Partial<AudioFeatures>) => void;
  
  // 会話の抑揚を表す状態（質問/強調/通常）
  intonation: 'normal' | 'question' | 'emphasis';
  setIntonation: (intonation: 'normal' | 'question' | 'emphasis') => void;
  
  // 文章の進行状況
  speechProgress: SpeechProgress;
  setSpeechProgress: (progress: Partial<SpeechProgress>) => void;
  updateWordIndex: (index: number) => void;
  
  // ミュート状態の管理
  isMuted: boolean;
  setMuted: (isMuted: boolean) => void;
  hasUserUnmuted: boolean;  // ユーザーが明示的にミュート解除したか
  setHasUserUnmuted: (hasUnmuted: boolean) => void;
};

export const useAudioStore = create<AudioStore>((set) => ({
  // 基本的な音声状態
  amp: 0,
  setAmp: (amp) => set({ amp }),
  isSpeaking: false,
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  
  // 音声特性の詳細（初期値）
  features: {
    amp: 0,
    lowFreq: 0,
    midFreq: 0,
    highFreq: 0,
    voicePitch: 0.5, // 0〜1の範囲、0.5が通常
    energyChange: 0
  },
  setFeatures: (features) => set((state) => ({
    features: { ...state.features, ...features }
  })),
  
  // 会話の抑揚の状態
  intonation: 'normal',
  setIntonation: (intonation) => set({ intonation }),
  
  // 文章の進行状況（初期値）
  speechProgress: {
    words: [],
    currentWordIndex: 0,
    progress: 0,
    currentWord: null,
    wordEmphasis: 0,
    isJapanese: false
  },
  setSpeechProgress: (progress) => set((state) => ({
    speechProgress: { ...state.speechProgress, ...progress }
  })),
  updateWordIndex: (index) => set((state) => {
    const words = state.speechProgress.words;
    // インデックスが有効範囲内かチェック
    if (index >= 0 && index < words.length) {
      return {
        speechProgress: {
          ...state.speechProgress,
          currentWordIndex: index,
          currentWord: words[index],
          progress: words.length > 0 ? index / (words.length - 1) : 0,
          // 単語ごとの強調度を計算（例：特定の単語や文末に近いと強調）
          wordEmphasis: calculateWordEmphasis(words, index, state.intonation)
        }
      };
    }
    return state;
  }),
  
  // ミュート状態の管理
  isMuted: true,  // デフォルトはミュート（ブラウザのautoplayポリシーに準拠）
  setMuted: (isMuted) => set({ isMuted }),
  hasUserUnmuted: false,
  setHasUserUnmuted: (hasUserUnmuted) => set({ hasUserUnmuted })
}));

// 単語の強調度を計算する補助関数
function calculateWordEmphasis(words: string[], index: number, intonation: 'normal' | 'question' | 'emphasis'): number {
  // 文章の長さを考慮
  const total = words.length;
  if (total <= 1) return 0.5;
  
  // 文末に近いほど強調（特に質問文）
  const positionFactor = index / (total - 1); // 0～1
  
  // 抑揚タイプに応じた強調パターン
  switch (intonation) {
    case 'question':
      // 質問は文末に向けて徐々に強調
      return 0.3 + positionFactor * 0.7; // 0.3～1.0
      
    case 'emphasis':
      // 強調は全体的に強いが、中盤が特に強い
      return 0.5 + Math.sin(positionFactor * Math.PI) * 0.5; // 0.5～1.0
      
    default: // 'normal'
      // 通常は波のような変化
      return 0.3 + Math.sin(positionFactor * Math.PI * 2) * 0.2 + positionFactor * 0.3; // 0.1～0.8
  }
}

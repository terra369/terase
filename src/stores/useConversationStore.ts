import { create } from 'zustand';

export type Message = {
  id: string;
  content: string;
  speaker: 'user' | 'ai';
  timestamp: Date;
  audioUrl?: string;
  isTranscribing?: boolean;
  isGenerating?: boolean;
};

export type ConversationState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

type ConversationStore = {
  // 会話の状態
  state: ConversationState;
  setState: (state: ConversationState) => void;
  
  // メッセージ履歴
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  
  // リアルタイム文字起こし
  liveTranscript: string;
  setLiveTranscript: (transcript: string) => void;
  
  // 音声録音状態
  isRecording: boolean;
  setRecording: (recording: boolean) => void;
  
  // エラー状態
  error: string | null;
  setError: (error: string | null) => void;
  
  // 会話セッション
  sessionId: string;
  startNewSession: () => void;
  
  // UIの設定
  showTranscript: boolean;
  toggleTranscript: () => void;
  
  // 音声処理
  currentAudioBlob: Blob | null;
  setCurrentAudioBlob: (blob: Blob | null) => void;
};

export const useConversationStore = create<ConversationStore>((set) => ({
  // 初期状態
  state: 'idle',
  setState: (state) => set({ state }),
  
  // メッセージ管理
  messages: [],
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };
    set((state) => ({
      messages: [...state.messages, newMessage]
    }));
  },
  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    }));
  },
  clearMessages: () => set({ messages: [] }),
  
  // リアルタイム文字起こし
  liveTranscript: '',
  setLiveTranscript: (transcript) => set({ liveTranscript: transcript }),
  
  // 録音状態
  isRecording: false,
  setRecording: (recording) => set({ isRecording: recording }),
  
  // エラー状態
  error: null,
  setError: (error) => set({ error }),
  
  // セッション管理
  sessionId: crypto.randomUUID(),
  startNewSession: () => set({ 
    sessionId: crypto.randomUUID(),
    messages: [],
    liveTranscript: '',
    error: null,
    state: 'idle'
  }),
  
  // UI設定
  showTranscript: true,
  toggleTranscript: () => set((state) => ({ 
    showTranscript: !state.showTranscript 
  })),
  
  // 音声処理
  currentAudioBlob: null,
  setCurrentAudioBlob: (blob) => set({ currentAudioBlob: blob })
}));
import { create } from 'zustand';

type AudioStore = {
  amp: number;
  setAmp: (amp: number) => void;
  isSpeaking: boolean; // AIが話しているかどうかの状態
  setSpeaking: (isSpeaking: boolean) => void;
};

export const useAudioStore = create<AudioStore>((set) => ({
  amp: 0,
  setAmp: (amp) => set({ amp }),
  isSpeaking: false,
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
}));

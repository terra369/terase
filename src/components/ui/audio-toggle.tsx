'use client'
import { Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/components/AudioProvider";

export function AudioToggle() {
  const { audioEnabled, toggleAudioEnabled } = useAudio();

  return (
    <button
      onClick={toggleAudioEnabled}
      className="p-2 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
      aria-label={audioEnabled ? "音声をミュート" : "音声を有効化"}
    >
      {audioEnabled ? (
        <Volume2 className="w-8 h-8" />
      ) : (
        <VolumeX className="w-8 h-8" />
      )}
    </button>
  );
}
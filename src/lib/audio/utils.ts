/**
 * Audio utilities
 * Extracted and organized from src/lib/audioUtils.ts
 */

export {
  isIOSSafari,
  isIOS,
  createIOSAudioElement,
  preloadAudioForIOS,
  playAudioWithIOSFallback,
  SILENT_AUDIO_DATA_URL
} from '../audioUtils';
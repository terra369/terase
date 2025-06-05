/**
 * Audio utilities barrel export
 * Centralizes all audio-related functionality
 */

// Audio context management
export {
  handleFirstUserInteraction,
  ensureAudioContextRunning,
  getAudioContext,
  initializeAudioContext
} from './context';

// Audio utilities
export {
  isIOSSafari,
  isIOS,
  createIOSAudioElement,
  preloadAudioForIOS,
  playAudioWithIOSFallback,
  SILENT_AUDIO_DATA_URL
} from './utils';

// Audio debug utilities
export {
  logAudioDebug,
  getAudioElementDebugInfo
} from './debug';

// Text-to-Speech utilities
export {
  streamTTS,
  unlockAudioPlayback,
  cleanupGlobalAudio
} from './tts';

// Re-export device detection for convenience
export { DeviceDetection } from '../deviceDetection';

// Re-export error handling for audio operations
export { ErrorHandler, ErrorUtils } from '../errorHandling';
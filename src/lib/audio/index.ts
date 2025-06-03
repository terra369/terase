/**
 * Audio utilities barrel export
 * Centralizes all audio-related functionality
 */

export { AudioContext } from './context';
export { AudioUtils } from './utils';
export { AudioDebug } from './debug';
export { TTS } from './tts';

// Re-export device detection for convenience
export { DeviceDetection } from '../deviceDetection';

// Re-export error handling for audio operations
export { ErrorHandler, ErrorUtils } from '../errorHandling';
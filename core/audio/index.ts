/**
 * Core Audio module barrel exports
 * Platform-agnostic audio functionality for Web/React Native reusability
 */

// Audio configuration and constants
export * from './config'

// Audio types and interfaces
export * from './types'

// Device detection utilities
export {
  AudioDeviceDetector,
  audioDeviceDetector,
  getDeviceInfo,
  getOptimalAudioFormat,
  getOptimalMimeType,
  requiresUserGesture,
} from './device-detection'

// State management
export {
  AudioRecordingStateMachine,
  createRecordingStateMachine,
} from './state-machine'

// Validation utilities
export {
  AudioValidator,
  validateRecording,
  validateTranscription,
  isValidRecordingFile,
  isValidTranscriptionFile,
  getValidationErrors,
} from './validation'

// Type-only exports for clarity
export type {
  DetectedDevice,
  StateTransition,
  StateTransitionEvent,
  AudioValidationResult,
  AudioValidationOptions,
} from './device-detection'
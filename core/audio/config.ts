/**
 * Platform-agnostic audio configuration
 * Core audio constants and settings for Web/React Native reusability
 */

import type { AudioFormat, AudioConfig } from '../api/types'

// Default audio recording configuration
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 16000,
  channels: 1,
  bitRate: 128000,
  format: 'webm' as AudioFormat,
}

// OpenAI Whisper optimal settings
export const WHISPER_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 16000,
  channels: 1,
  format: 'wav' as AudioFormat,
}

// Platform-specific MIME type mappings
export const MIME_TYPE_MAPPINGS: Record<string, AudioFormat> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/mp4': 'mp4',
  'audio/mp4;codecs=mp4a.40.2': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/m4a': 'm4a',
}

// File extension mappings
export const EXTENSION_MAPPINGS: Record<AudioFormat, string> = {
  webm: '.webm',
  mp4: '.mp4',
  mp3: '.mp3',
  wav: '.wav',
  m4a: '.m4a',
}

// Audio format quality rankings (higher = better quality)
export const FORMAT_QUALITY_RANK: Record<AudioFormat, number> = {
  wav: 5,
  m4a: 4,
  mp4: 3,
  mp3: 2,
  webm: 1,
}

// Maximum file sizes (in bytes)
export const MAX_FILE_SIZES = {
  RECORDING: 50 * 1024 * 1024, // 50MB
  TRANSCRIPTION: 25 * 1024 * 1024, // 25MB
  TTS_RESPONSE: 10 * 1024 * 1024, // 10MB
} as const

// Audio processing timeouts (in milliseconds)
export const TIMEOUTS = {
  RECORDING_MAX: 10 * 60 * 1000, // 10 minutes
  TRANSCRIPTION: 60 * 1000, // 60 seconds
  TTS: 30 * 1000, // 30 seconds
  UPLOAD: 120 * 1000, // 2 minutes
} as const

// Device-specific configurations
export const DEVICE_CONFIGS = {
  ios: {
    preferredMimeTypes: ['audio/mp4', 'audio/m4a', 'audio/wav'],
    fallbackMimeTypes: ['audio/webm'],
    requiresUserGesture: true,
  },
  android: {
    preferredMimeTypes: ['audio/webm', 'audio/mp4', 'audio/wav'],
    fallbackMimeTypes: ['audio/m4a'],
    requiresUserGesture: false,
  },
  web: {
    preferredMimeTypes: ['audio/webm', 'audio/mp4', 'audio/wav'],
    fallbackMimeTypes: ['audio/m4a', 'audio/mpeg'],
    requiresUserGesture: false,
  },
} as const

// Audio visualization settings
export const VISUALIZATION_CONFIG = {
  fftSize: 256,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
  frequencyBinCount: 128,
} as const

// Voice activity detection thresholds
export const VAD_CONFIG = {
  silenceThreshold: 0.01, // Amplitude threshold for silence
  silenceDurationMs: 2000, // How long silence before stopping
  minimumRecordingMs: 500, // Minimum recording length
  maxRecordingMs: TIMEOUTS.RECORDING_MAX,
} as const

// TTS voice configurations
export const TTS_VOICES = {
  alloy: { gender: 'neutral', language: 'multi', description: 'Balanced and clear' },
  echo: { gender: 'male', language: 'multi', description: 'Deep and resonant' },
  fable: { gender: 'neutral', language: 'multi', description: 'Expressive and dynamic' },
  onyx: { gender: 'male', language: 'multi', description: 'Professional and authoritative' },
  nova: { gender: 'female', language: 'multi', description: 'Warm and engaging' },
  shimmer: { gender: 'female', language: 'multi', description: 'Soft and soothing' },
} as const

// Audio processing quality presets
export const QUALITY_PRESETS = {
  low: {
    sampleRate: 8000,
    channels: 1,
    bitRate: 64000,
  },
  medium: {
    sampleRate: 16000,
    channels: 1,
    bitRate: 128000,
  },
  high: {
    sampleRate: 44100,
    channels: 2,
    bitRate: 256000,
  },
} as const

// Utility functions for configuration
export const getOptimalConfigForPlatform = (platform: keyof typeof DEVICE_CONFIGS): AudioConfig => {
  const deviceConfig = DEVICE_CONFIGS[platform]
  const preferredFormat = MIME_TYPE_MAPPINGS[deviceConfig.preferredMimeTypes[0]]
  
  return {
    ...DEFAULT_AUDIO_CONFIG,
    format: preferredFormat || DEFAULT_AUDIO_CONFIG.format,
  }
}

export const isFormatSupported = (format: AudioFormat, platform: keyof typeof DEVICE_CONFIGS): boolean => {
  const deviceConfig = DEVICE_CONFIGS[platform]
  const mimeType = Object.keys(MIME_TYPE_MAPPINGS).find(
    key => MIME_TYPE_MAPPINGS[key] === format
  )
  
  return mimeType ? 
    [...deviceConfig.preferredMimeTypes, ...deviceConfig.fallbackMimeTypes].includes(mimeType) :
    false
}

export const getFileExtension = (format: AudioFormat): string => {
  return EXTENSION_MAPPINGS[format] || '.audio'
}

export const getFormatFromMimeType = (mimeType: string): AudioFormat => {
  return MIME_TYPE_MAPPINGS[mimeType] || 'webm'
}
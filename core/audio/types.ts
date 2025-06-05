/**
 * Platform-agnostic audio types
 * Core audio type definitions for Web/React Native reusability
 */

// Re-export shared types from API
export type {
  AudioFormat,
  AudioConfig,
  AudioBlob,
} from '../api/types'

// Audio-specific types
export type RecordingState = 'idle' | 'requesting-permission' | 'recording' | 'processing' | 'completed' | 'error'

export interface RecordingSession {
  id: string
  startTime: Date
  endTime?: Date
  state: RecordingState
  audioBlob?: AudioBlob
  error?: string
}

export interface AudioPermissions {
  microphone: 'granted' | 'denied' | 'prompt'
  speaker: 'granted' | 'denied' | 'prompt'
}

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
  groupId?: string
}

export interface AudioConstraints {
  audio: {
    deviceId?: string
    sampleRate?: number
    channelCount?: number
    echoCancellation?: boolean
    noiseSuppression?: boolean
    autoGainControl?: boolean
  }
}

export interface AudioAnalyzer {
  frequencyData: Uint8Array
  timeData: Uint8Array
  volume: number
  isActive: boolean
}

export interface AudioPlaybackOptions {
  volume?: number
  playbackRate?: number
  loop?: boolean
  autoplay?: boolean
}

export interface AudioRecordingOptions {
  maxDuration?: number
  minDuration?: number
  silenceDetection?: boolean
  qualityPreset?: 'low' | 'medium' | 'high'
  deviceId?: string
}

// Platform adapter interfaces
export interface AudioRecorderAdapter {
  requestPermission(): Promise<boolean>
  startRecording(options?: AudioRecordingOptions): Promise<void>
  stopRecording(): Promise<AudioBlob>
  pauseRecording(): Promise<void>
  resumeRecording(): Promise<void>
  getRecordingState(): RecordingState
  getRecordingDuration(): number
  cleanup(): void
}

export interface AudioPlayerAdapter {
  load(audioBlob: AudioBlob): Promise<void>
  play(options?: AudioPlaybackOptions): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  seek(time: number): Promise<void>
  getDuration(): number
  getCurrentTime(): number
  getVolume(): number
  setVolume(volume: number): void
  cleanup(): void
}

export interface AudioContextAdapter {
  createRecorder(constraints?: AudioConstraints): Promise<AudioRecorderAdapter>
  createPlayer(): AudioPlayerAdapter
  getAnalyzer(): AudioAnalyzer | null
  getPermissions(): Promise<AudioPermissions>
  getDevices(): Promise<AudioDevice[]>
  isSupported(): boolean
  cleanup(): void
}

// Audio processing types
export interface AudioProcessor {
  process(audioBlob: AudioBlob): Promise<AudioBlob>
  normalize(audioBlob: AudioBlob): Promise<AudioBlob>
  compress(audioBlob: AudioBlob, quality: number): Promise<AudioBlob>
  convert(audioBlob: AudioBlob, targetFormat: AudioFormat): Promise<AudioBlob>
}

export interface AudioMetadata {
  duration: number
  format: AudioFormat
  size: number
  sampleRate?: number
  channels?: number
  bitRate?: number
  createdAt: Date
}

// Voice activity detection
export interface VoiceActivityDetector {
  isVoiceActive(audioData: Float32Array): boolean
  getSilenceDuration(): number
  getActivityLevel(): number
  reset(): void
}

// Audio visualization
export interface AudioVisualizer {
  getFrequencyData(): Uint8Array
  getTimeData(): Uint8Array
  getVolume(): number
  start(): void
  stop(): void
}

// Error types specific to audio
export type AudioErrorType = 
  | 'permission_denied'
  | 'device_not_found'
  | 'recording_failed'
  | 'playback_failed'
  | 'format_not_supported'
  | 'duration_too_short'
  | 'duration_too_long'
  | 'file_too_large'
  | 'processing_failed'

export interface AudioError extends Error {
  type: AudioErrorType
  code?: string
  originalError?: Error
}

// Platform detection for audio features
export interface AudioCapabilities {
  canRecord: boolean
  canPlayback: boolean
  supportedFormats: AudioFormat[]
  maxRecordingDuration: number
  hasVoiceActivityDetection: boolean
  hasEchoCancellation: boolean
  hasNoiseSuppression: boolean
  requiresUserGesture: boolean
}

// Event types for audio adapters
export interface AudioRecorderEvents {
  'recording-started': () => void
  'recording-stopped': (audioBlob: AudioBlob) => void
  'recording-paused': () => void
  'recording-resumed': () => void
  'recording-error': (error: AudioError) => void
  'volume-changed': (volume: number) => void
  'duration-changed': (duration: number) => void
}

export interface AudioPlayerEvents {
  'loaded': (metadata: AudioMetadata) => void
  'play': () => void
  'pause': () => void
  'stop': () => void
  'ended': () => void
  'error': (error: AudioError) => void
  'time-update': (currentTime: number) => void
  'volume-changed': (volume: number) => void
}

// Utility types
export type AudioEventCallback<T extends keyof AudioRecorderEvents> = AudioRecorderEvents[T]
export type PlayerEventCallback<T extends keyof AudioPlayerEvents> = AudioPlayerEvents[T]
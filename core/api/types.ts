/**
 * Platform-agnostic API types and interfaces
 * Core type definitions for Web/React Native reusability
 */

// HTTP method types
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// Generic API response wrapper
export interface APIResponse<T = unknown> {
  data?: T
  error?: string
  code?: string
  success: boolean
}

// API client configuration
export interface APIClientConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
  retryAttempts?: number
  retryDelay?: number
}

// Request options
export interface APIRequestOptions {
  method: HTTPMethod
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

// Authentication context
export interface AuthContext {
  userId: string
  token: string
  refreshToken?: string
  expiresAt?: Date
}

// Platform adapter interface for HTTP requests
export interface HTTPAdapter {
  request<T>(url: string, options: APIRequestOptions): Promise<APIResponse<T>>
}

// Platform adapter interface for file uploads
export interface FileUploadAdapter {
  uploadFile(file: File | Blob, path: string, options?: FileUploadOptions): Promise<string>
}

export interface FileUploadOptions {
  bucketName?: string
  contentType?: string
  metadata?: Record<string, string>
  onProgress?: (progress: number) => void
}

// Audio processing types
export interface AudioConfig {
  sampleRate: number
  channels: number
  bitRate?: number
  format: AudioFormat
}

export type AudioFormat = 'wav' | 'mp3' | 'webm' | 'mp4' | 'm4a'

export interface AudioBlob {
  blob: Blob
  format: AudioFormat
  duration?: number
  size: number
}

// Conversation types
export interface ConversationContext {
  diaryId?: number
  previousMessages: ConversationMessage[]
  userProfile?: UserProfile
  settings?: ConversationSettings
}

export interface ConversationMessage {
  role: 'user' | 'ai'
  text: string
  audioUrl?: string
  timestamp: Date
}

export interface ConversationSettings {
  language: string
  aiPersonality: string
  responseLength: 'short' | 'medium' | 'long'
}

export interface UserProfile {
  id: string
  displayName: string
  fairyName: string
  fairyImageUrl?: string
}

// Error types
export type ErrorCategory = 
  | 'recording' 
  | 'transcription' 
  | 'ai' 
  | 'network' 
  | 'permission' 
  | 'validation' 
  | 'tts' 
  | 'auth' 
  | 'storage'
  | 'unknown'

export interface TerazeError {
  category: ErrorCategory
  message: string
  code?: string
  originalError?: Error
  userMessage: string
  isRetryable: boolean
  timestamp: Date
}

// State management types
export type RecordingState = 'idle' | 'requesting-permission' | 'recording' | 'processing' | 'error'

export interface ConversationState {
  recordingState: RecordingState
  isProcessing: boolean
  error?: TerazeError
  currentMessage?: string
  audioBlob?: AudioBlob
}

// Platform detection types
export interface DeviceInfo {
  platform: 'web' | 'ios' | 'android'
  browser?: string
  isIOSSafari: boolean
  isMobile: boolean
  requiresUserGesture: boolean
  supportedAudioFormats: AudioFormat[]
  optimalMimeType: string
}

// Storage types
export interface StorageAdapter {
  uploadAudio(blob: AudioBlob, path: string): Promise<string>
  downloadAudio(url: string): Promise<AudioBlob>
  deleteAudio(path: string): Promise<void>
}

export interface DatabaseAdapter {
  saveDiary(diary: SaveDiaryRequest): Promise<Diary>
  getDiary(date: string): Promise<Diary | null>
  listDiaries(options: ListDiariesRequest): Promise<Diary[]>
  saveMessage(message: DiaryMessageRequest): Promise<DiaryMessage>
  getMessages(diaryId: number): Promise<DiaryMessage[]>
}

// Re-export schema types
export type {
  AIChatRequest,
  TranscribeRequest,
  TTSRequest,
  SaveDiaryRequest,
  DiaryMessageRequest,
  GetDiaryRequest,
  ListDiariesRequest,
  APIError,
  Diary,
  DiaryMessage,
} from './schemas'
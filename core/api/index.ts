/**
 * Core API module barrel exports
 * Platform-agnostic API layer for Web/React Native reusability
 */

// Core API classes
export { APIClient } from './client'

// API schemas and validation
export * from './schemas'
export * from './types'

// Service classes
export { AIChatService, createAIChatService } from './services/ai-chat'
export { TranscriptionService, createTranscriptionService } from './services/transcription'
export { TTSService, createTTSService } from './services/tts'

// Type-only exports for clear separation
export type {
  APIResponse,
  APIClientConfig,
  APIRequestOptions,
  HTTPAdapter,
  FileUploadAdapter,
  AuthContext,
  ConversationContext,
  ConversationMessage,
  AudioBlob,
  TerazeError,
  ErrorCategory,
} from './types'
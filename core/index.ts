/**
 * Core Platform-Agnostic Module
 * Main barrel export for Web/React Native reusability
 * 
 * This core module provides platform-agnostic business logic, API communication,
 * audio processing, and utility functions that can be shared between Web and
 * React Native implementations of the terase application.
 */

// API Layer - HTTP client, schemas, and services
export * from './api'

// Audio Layer - Recording, processing, and device detection
export * from './audio'

// Business Logic - Conversation flow and diary operations
export * from './business'

// Utilities - Error handling, validation, device detection
export * from './utils'

// Core version for dependency tracking
export const CORE_VERSION = '1.0.0'

// Platform adapters interface definitions for implementation guidance
export interface PlatformAdapters {
  http: import('./api/types').HTTPAdapter
  storage: import('./api/types').StorageAdapter
  database: import('./api/types').DatabaseAdapter
  audioRecorder: import('./audio/types').AudioRecorderAdapter
  audioPlayer: import('./audio/types').AudioPlayerAdapter
  audioContext: import('./audio/types').AudioContextAdapter
}

// Core initialization function for platform-specific implementations
export interface CoreInitOptions {
  apiBaseURL: string
  enableLogging?: boolean
  maxRetries?: number
  timeout?: number
}

export const initializeCore = (
  adapters: PlatformAdapters,
  options: CoreInitOptions
) => {
  // This would be implemented by platform-specific code
  // to wire up all the core modules with the platform adapters
  return {
    apiClient: new (require('./api').APIClient)(
      {
        baseURL: options.apiBaseURL,
        timeout: options.timeout || 30000,
        retryAttempts: options.maxRetries || 3,
      },
      adapters.http
    ),
    audioDetector: require('./audio').audioDeviceDetector,
    errorHandler: require('./utils').ErrorHandler,
    // ... other core instances
  }
}
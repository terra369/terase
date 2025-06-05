/**
 * Error handling - now extends core platform-agnostic error handling
 * This file provides backward compatibility while leveraging the new core module
 */

// Re-export core error handling
export {
  ErrorHandler,
  handleAsyncError,
  handleSyncError,
  retryWithBackoff
} from '../../core/utils/error-handling';

// Re-export types with legacy names for compatibility
export type {
  ErrorCategory as ErrorType,
  TerazeError
} from '../../core/api/types';

// Legacy compatibility functions
export function createError(type: ErrorType, error: unknown, userMessage?: string): TerazeError {
  return ErrorHandler.create(type, error instanceof Error ? error.message : String(error), undefined, error instanceof Error ? error : undefined);
}

// Utility functions for common error scenarios - now using core ErrorHandler
export const ErrorUtils = {
  transcription: (error: unknown) => ErrorHandler.fromUnknown(error, 'transcription'),
  ai: (error: unknown) => ErrorHandler.fromUnknown(error, 'ai'),
  recording: (error: unknown) => ErrorHandler.fromUnknown(error, 'recording'),
  network: (error: unknown) => ErrorHandler.fromUnknown(error, 'network'),
  permission: (error: unknown) => ErrorHandler.fromUnknown(error, 'permission'),
  tts: (error: unknown) => ErrorHandler.fromUnknown(error, 'tts'),
  auth: (error: unknown) => ErrorHandler.fromUnknown(error, 'auth'),
  validation: (error: unknown) => ErrorHandler.fromUnknown(error, 'validation'),
} as const;
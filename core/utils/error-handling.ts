/**
 * Platform-agnostic error handling utilities
 * Enhanced error management system extracted from src/lib/errorHandling.ts
 */

import type { ErrorCategory, TerazeError } from '../api/types'

export class ErrorHandler {
  private static readonly ERROR_MESSAGES: Record<ErrorCategory, string> = {
    recording: '録音中にエラーが発生しました。マイクの権限を確認してください。',
    transcription: '音声認識でエラーが発生しました。もう一度お試しください。',
    ai: 'AI応答の生成でエラーが発生しました。しばらく待ってからお試しください。',
    network: 'ネットワークエラーが発生しました。接続を確認してください。',
    permission: '権限が不足しています。設定を確認してください。',
    validation: '入力データに問題があります。確認してください。',
    tts: '音声合成でエラーが発生しました。もう一度お試しください。',
    auth: '認証エラーが発生しました。ログインし直してください。',
    storage: 'データの保存でエラーが発生しました。しばらく待ってからお試しください。',
    unknown: 'エラーが発生しました。もう一度お試しください。',
  }

  private static readonly RETRYABLE_CATEGORIES: Set<ErrorCategory> = new Set([
    'network',
    'transcription',
    'ai',
    'tts',
    'storage',
    'unknown',
  ])

  static fromUnknown(error: unknown, category: ErrorCategory = 'unknown'): TerazeError {
    const timestamp = new Date()

    if (error instanceof Error) {
      return {
        category,
        message: error.message,
        originalError: error,
        userMessage: this.ERROR_MESSAGES[category],
        isRetryable: this.RETRYABLE_CATEGORIES.has(category),
        timestamp,
      }
    }

    if (typeof error === 'string') {
      return {
        category,
        message: error,
        userMessage: this.ERROR_MESSAGES[category],
        isRetryable: this.RETRYABLE_CATEGORIES.has(category),
        timestamp,
      }
    }

    return {
      category: 'unknown',
      message: 'Unknown error occurred',
      userMessage: this.ERROR_MESSAGES.unknown,
      isRetryable: true,
      timestamp,
    }
  }

  static create(
    category: ErrorCategory,
    message: string,
    code?: string,
    originalError?: Error
  ): TerazeError {
    return {
      category,
      message,
      code,
      originalError,
      userMessage: this.ERROR_MESSAGES[category],
      isRetryable: this.RETRYABLE_CATEGORIES.has(category),
      timestamp: new Date(),
    }
  }

  static isRetryable(error: TerazeError): boolean {
    return error.isRetryable
  }

  static getUserMessage(error: TerazeError): string {
    return error.userMessage
  }

  static getCategory(error: TerazeError): ErrorCategory {
    return error.category
  }

  static shouldLog(error: TerazeError): boolean {
    // Log all errors except validation errors (usually user input issues)
    return error.category !== 'validation'
  }

  static logError(error: TerazeError): void {
    if (!this.shouldLog(error)) {
      return
    }

    const logData = {
      category: error.category,
      message: error.message,
      code: error.code,
      timestamp: error.timestamp.toISOString(),
      originalError: error.originalError?.stack,
    }

    console.error(`[TerazeError:${error.category}]`, logData)
  }

  static createNetworkError(message: string, status?: number): TerazeError {
    return this.create(
      'network',
      message,
      status ? `HTTP_${status}` : undefined
    )
  }

  static createValidationError(message: string, field?: string): TerazeError {
    return this.create(
      'validation',
      message,
      field ? `VALIDATION_${field.toUpperCase()}` : 'VALIDATION_ERROR'
    )
  }

  static createRecordingError(message: string): TerazeError {
    return this.create('recording', message)
  }

  static createTranscriptionError(message: string): TerazeError {
    return this.create('transcription', message)
  }

  static createAIError(message: string): TerazeError {
    return this.create('ai', message)
  }

  static createTTSError(message: string): TerazeError {
    return this.create('tts', message)
  }

  static createAuthError(message: string): TerazeError {
    return this.create('auth', message)
  }

  static createStorageError(message: string): TerazeError {
    return this.create('storage', message)
  }

  static createPermissionError(message: string): TerazeError {
    return this.create('permission', message)
  }
}

// Utility function for safe error handling in async operations
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  category: ErrorCategory = 'unknown'
): Promise<{ success: true; data: T } | { success: false; error: TerazeError }> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    const terazeError = ErrorHandler.fromUnknown(error, category)
    ErrorHandler.logError(terazeError)
    return { success: false, error: terazeError }
  }
}

// Utility function for safe synchronous error handling
export function handleSyncError<T>(
  operation: () => T,
  category: ErrorCategory = 'unknown'
): { success: true; data: T } | { success: false; error: TerazeError } {
  try {
    const data = operation()
    return { success: true, data }
  } catch (error) {
    const terazeError = ErrorHandler.fromUnknown(error, category)
    ErrorHandler.logError(terazeError)
    return { success: false, error: terazeError }
  }
}

// Retry mechanism with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  category: ErrorCategory = 'unknown'
): Promise<T> {
  let lastError: TerazeError | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = ErrorHandler.fromUnknown(error, category)

      // Don't retry if error is not retryable
      if (!lastError.isRetryable) {
        break
      }

      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  if (lastError) {
    ErrorHandler.logError(lastError)
    throw lastError
  }

  throw ErrorHandler.create(category, 'Maximum retry attempts exceeded')
}

// Error boundary helper for React components (can be adapted for React Native)
export interface ErrorBoundaryState {
  hasError: boolean
  error?: TerazeError
}

export const createErrorBoundaryState = (): ErrorBoundaryState => ({
  hasError: false,
  error: undefined,
})

export const handleErrorBoundary = (
  error: Error,
  category: ErrorCategory = 'unknown'
): ErrorBoundaryState => {
  const terazeError = ErrorHandler.fromUnknown(error, category)
  ErrorHandler.logError(terazeError)
  
  return {
    hasError: true,
    error: terazeError,
  }
}

// Performance monitoring integration
export interface PerformanceMetrics {
  operation: string
  duration: number
  success: boolean
  error?: TerazeError
  timestamp: Date
}

export class PerformanceTracker {
  private static metrics: PerformanceMetrics[] = []

  static async trackOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    category: ErrorCategory = 'unknown'
  ): Promise<T> {
    const startTime = performance.now()
    const timestamp = new Date()

    try {
      const result = await operation()
      const duration = performance.now() - startTime

      this.metrics.push({
        operation: operationName,
        duration,
        success: true,
        timestamp,
      })

      return result
    } catch (error) {
      const duration = performance.now() - startTime
      const terazeError = ErrorHandler.fromUnknown(error, category)

      this.metrics.push({
        operation: operationName,
        duration,
        success: false,
        error: terazeError,
        timestamp,
      })

      throw terazeError
    }
  }

  static getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  static clearMetrics(): void {
    this.metrics = []
  }

  static getAverageOperationTime(operationName: string): number {
    const operationMetrics = this.metrics.filter(m => m.operation === operationName)
    if (operationMetrics.length === 0) return 0

    const totalTime = operationMetrics.reduce((sum, m) => sum + m.duration, 0)
    return totalTime / operationMetrics.length
  }
}
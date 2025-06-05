/**
 * Platform-agnostic API client
 * Core HTTP client with adapter pattern for Web/React Native compatibility
 */

import type {
  APIResponse,
  APIClientConfig,
  APIRequestOptions,
  HTTPAdapter,
  AuthContext,
  ErrorCategory,
  TerazeError,
} from './types'

export class APIClient {
  private config: APIClientConfig
  private httpAdapter: HTTPAdapter
  private authContext?: AuthContext

  constructor(config: APIClientConfig, httpAdapter: HTTPAdapter) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    }
    this.httpAdapter = httpAdapter
  }

  setAuth(authContext: AuthContext) {
    this.authContext = authContext
  }

  clearAuth() {
    this.authContext = undefined
  }

  async request<T>(
    endpoint: string, 
    options: Partial<APIRequestOptions> = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...options.headers,
    }

    // Add authentication header if available
    if (this.authContext?.token) {
      headers['Authorization'] = `Bearer ${this.authContext.token}`
    }

    const requestOptions: APIRequestOptions = {
      method: 'GET',
      ...options,
      headers,
      timeout: options.timeout || this.config.timeout,
    }

    try {
      return await this.executeWithRetry(url, requestOptions)
    } catch (error) {
      const terazeError = this.handleError(error, 'network')
      return {
        success: false,
        error: terazeError.userMessage,
        code: terazeError.code,
      }
    }
  }

  async get<T>(endpoint: string, options?: Partial<APIRequestOptions>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T>(
    endpoint: string, 
    data?: unknown, 
    options?: Partial<APIRequestOptions>
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data,
    })
  }

  async put<T>(
    endpoint: string, 
    data?: unknown, 
    options?: Partial<APIRequestOptions>
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data,
    })
  }

  async delete<T>(endpoint: string, options?: Partial<APIRequestOptions>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  private async executeWithRetry<T>(
    url: string, 
    options: APIRequestOptions
  ): Promise<APIResponse<T>> {
    let lastError: Error | undefined
    
    for (let attempt = 0; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(this.config.retryDelay! * Math.pow(2, attempt - 1))
        }
        
        return await this.httpAdapter.request<T>(url, options)
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on 4xx errors (client errors)
        if (this.isClientError(error)) {
          break
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.retryAttempts!) {
          break
        }
      }
    }
    
    throw lastError
  }

  private handleError(error: unknown, category: ErrorCategory): TerazeError {
    const timestamp = new Date()
    
    if (error instanceof Error) {
      return {
        category,
        message: error.message,
        originalError: error,
        userMessage: this.getLocalizedErrorMessage(category, error.message),
        isRetryable: this.isRetryableError(error),
        timestamp,
      }
    }
    
    return {
      category: 'unknown',
      message: 'Unknown error occurred',
      userMessage: 'エラーが発生しました。もう一度お試しください。',
      isRetryable: true,
      timestamp,
    }
  }

  private getLocalizedErrorMessage(category: ErrorCategory, message: string): string {
    const errorMessages: Record<ErrorCategory, string> = {
      network: 'ネットワークエラーが発生しました。接続を確認してください。',
      auth: '認証エラーが発生しました。ログインし直してください。',
      validation: '入力データに問題があります。確認してください。',
      recording: '録音中にエラーが発生しました。',
      transcription: '音声認識でエラーが発生しました。',
      ai: 'AI応答の生成でエラーが発生しました。',
      tts: '音声合成でエラーが発生しました。',
      storage: 'データの保存でエラーが発生しました。',
      permission: '権限が不足しています。設定を確認してください。',
      unknown: 'エラーが発生しました。もう一度お試しください。',
    }
    
    return errorMessages[category] || errorMessages.unknown
  }

  private isRetryableError(error: Error): boolean {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504]
    const statusMatch = error.message.match(/status:?\s*(\d+)/i)
    
    if (statusMatch) {
      const status = parseInt(statusMatch[1])
      return retryableStatusCodes.includes(status)
    }
    
    // Network errors are generally retryable
    return error.message.includes('network') || 
           error.message.includes('timeout') ||
           error.message.includes('connection')
  }

  private isClientError(error: unknown): boolean {
    if (error instanceof Error) {
      const statusMatch = error.message.match(/status:?\s*(\d+)/i)
      if (statusMatch) {
        const status = parseInt(statusMatch[1])
        return status >= 400 && status < 500
      }
    }
    return false
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
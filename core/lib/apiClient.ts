/**
 * Unified API Client for terase application
 * 
 * Provides type-safe HTTP methods with consistent error handling, retry logic,
 * and integration with existing error handling and validation systems.
 */

import { ErrorHandler, type TerazeError } from '@/lib/errorHandling';

/**
 * API Error interface extending TerazeError for API-specific errors
 */
export interface APIError extends TerazeError {
  status?: number;
  statusText?: string;
  data?: any;
  url?: string;
}

/**
 * API Response interface for successful responses
 */
export interface APIResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  url: string;
}

/**
 * Request configuration interface
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  data?: any;
  timeout?: number;
}

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition: (error: APIError) => boolean;
}

/**
 * API Client configuration interface
 */
export interface APIClientConfig {
  baseURL?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  retryConfig?: RetryConfig;
}

/**
 * Request interceptor function type
 */
export type RequestInterceptor = (config: RequestConfig & { url: string; method: string }) => RequestConfig & { url: string; method: string };

/**
 * Response interceptor function type
 */
export type ResponseInterceptor = (response: APIResponse) => APIResponse;

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryCondition: (error: APIError) => {
    // Retry on network errors and 5xx server errors
    return !error.status || error.status >= 500;
  },
};

/**
 * Default client configuration
 */
const DEFAULT_CONFIG: Required<APIClientConfig> = {
  baseURL: '',
  timeout: 30000,
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  retryConfig: DEFAULT_RETRY_CONFIG,
};

/**
 * Unified API Client class
 */
export class APIClient {
  private config: Required<APIClientConfig>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(config: APIClientConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      defaultHeaders: {
        ...DEFAULT_CONFIG.defaultHeaders,
        ...config.defaultHeaders,
      },
      retryConfig: {
        ...DEFAULT_CONFIG.retryConfig,
        ...config.retryConfig,
      },
    };
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Build full URL from endpoint and base URL
   */
  private buildURL(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(endpoint, this.config.baseURL || window?.location?.origin || '');
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    return url.toString();
  }

  /**
   * Prepare headers for request
   */
  private prepareHeaders(customHeaders: Record<string, string> = {}, data?: any): Headers {
    const headers = new Headers();
    
    // Add default headers
    Object.entries(this.config.defaultHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    // Add custom headers (override defaults)
    Object.entries(customHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    // For FormData, remove Content-Type to let browser set it with boundary
    if (data instanceof FormData) {
      headers.delete('Content-Type');
    }
    
    return headers;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    
    if (response.status === 204 || !contentType) {
      return null;
    }
    
    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      // If parsing fails, try to get text content
      try {
        return await response.text();
      } catch {
        return null;
      }
    }
  }

  /**
   * Create API error from response or exception
   */
  private async createAPIError(error: any, url: string): Promise<APIError> {
    if (error instanceof Response) {
      // HTTP error response
      const data = await this.parseResponse(error);
      
      return {
        type: error.status >= 400 && error.status < 500 ? 'validation' : 'network',
        message: data?.message || data?.error || error.statusText || `HTTP ${error.status}`,
        originalError: error,
        status: error.status,
        statusText: error.statusText,
        data,
        url,
        userMessage: this.getErrorUserMessage(error.status, data),
        retryable: this.config.retryConfig.retryCondition({ 
          type: 'network', 
          message: '', 
          status: error.status,
          userMessage: '',
          retryable: false,
          originalError: error 
        }),
      };
    } else {
      // Network or other error
      const isTimeoutError = error.name === 'AbortError' || error.message?.includes('timeout');
      
      return {
        type: 'network',
        message: error.message || 'Network error occurred',
        originalError: error,
        url,
        userMessage: isTimeoutError ? 
          'タイムアウトが発生しました。しばらく待ってから再試行してください。' :
          'ネットワークエラーが発生しました。接続を確認してください。',
        retryable: !isTimeoutError && this.config.retryConfig.retryCondition({
          type: 'network',
          message: error.message,
          userMessage: '',
          retryable: false,
          originalError: error
        }),
      };
    }
  }

  /**
   * Get user-friendly error message based on status code
   */
  private getErrorUserMessage(status: number, data?: any): string {
    const customMessage = data?.userMessage || data?.message;
    if (customMessage) return customMessage;
    
    switch (status) {
      case 400:
        return 'リクエストが無効です。入力内容を確認してください。';
      case 401:
        return 'ログインが必要です。再度ログインしてください。';
      case 403:
        return 'この操作を実行する権限がありません。';
      case 404:
        return 'リクエストされたデータが見つかりません。';
      case 409:
        return 'データの競合が発生しました。再度お試しください。';
      case 422:
        return '入力データに問題があります。内容を確認してください。';
      case 429:
        return 'リクエストが多すぎます。しばらく待ってから再試行してください。';
      case 500:
        return 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
      case 502:
      case 503:
      case 504:
        return 'サービスが一時的に利用できません。しばらく待ってから再試行してください。';
      default:
        return 'エラーが発生しました。しばらく待ってから再試行してください。';
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<APIResponse<T>>,
    url: string
  ): Promise<APIResponse<T>> {
    let lastError: APIError | null = null;
    const maxAttempts = this.config.retryConfig.maxRetries + 1;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as APIError;
        
        // Don't retry on last attempt or if error is not retryable
        if (attempt === maxAttempts || !lastError.retryable) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = this.config.retryConfig.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Core request method
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<APIResponse<T>> {
    const url = this.buildURL(endpoint, config.params);
    const headers = this.prepareHeaders(config.headers, config.data);
    
    // Apply request interceptors
    let requestConfig = { url, method, ...config };
    for (const interceptor of this.requestInterceptors) {
      requestConfig = interceptor(requestConfig);
    }
    
    const requestFn = async (): Promise<APIResponse<T>> => {
      // Setup AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, config.timeout || this.config.timeout);
      
      try {
        // Prepare body
        let body: string | FormData | undefined;
        if (config.data) {
          if (config.data instanceof FormData) {
            body = config.data;
          } else if (typeof config.data === 'object') {
            body = JSON.stringify(config.data);
          } else {
            body = String(config.data);
          }
        }
        
        // Make request
        const response = await fetch(requestConfig.url, {
          method: requestConfig.method,
          headers,
          body,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Check if response is ok
        if (!response.ok) {
          throw response;
        }
        
        // Parse response data
        const data = await this.parseResponse(response);
        
        let apiResponse: APIResponse<T> = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          url: response.url,
        };
        
        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          apiResponse = interceptor(apiResponse);
        }
        
        return apiResponse;
        
      } catch (error) {
        clearTimeout(timeoutId);
        throw await this.createAPIError(error, requestConfig.url);
      }
    };
    
    return this.executeWithRetry(requestFn, url);
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, config: RequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>('GET', endpoint, config);
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, config: RequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>('POST', endpoint, config);
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, config: RequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>('PUT', endpoint, config);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, config: RequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', endpoint, config);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, config: RequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', endpoint, config);
  }
}

/**
 * Default API client instance
 */
export const apiClient = new APIClient();

/**
 * Create a configured API client for specific use cases
 */
export function createAPIClient(config: APIClientConfig): APIClient {
  return new APIClient(config);
}

/**
 * Helper function for creating authenticated API client
 */
export function createAuthenticatedAPIClient(token: string, config: APIClientConfig = {}): APIClient {
  return new APIClient({
    ...config,
    defaultHeaders: {
      'Authorization': `Bearer ${token}`,
      ...config.defaultHeaders,
    },
  });
}

/**
 * SWR-compatible fetcher function
 */
export async function apiFetcher<T = any>(url: string): Promise<T> {
  const response = await apiClient.get<T>(url);
  return response.data;
}

/**
 * Type-safe API endpoint builder
 */
export class APIEndpoints {
  static diaries = {
    list: (month?: string) => `/api/diaries${month ? `?month=${month}` : ''}`,
    byDate: (date: string) => `/api/diaries/${date}`,
    messages: (date?: string) => `/api/diaries/messages${date ? `?date=${date}` : ''}`,
  };
  
  static ai = {
    chat: () => '/api/ai-chat',
    transcribe: () => '/api/transcribe',
    tts: () => '/api/tts',
  };
  
  static actions = {
    saveDiary: () => '/api/actions/saveDiary',
  };
}

/**
 * Type-safe API client with predefined endpoints
 */
export class TypedAPIClient {
  constructor(private client: APIClient = apiClient) {}
  
  // Diary endpoints
  async getDiaries(month?: string) {
    return this.client.get(APIEndpoints.diaries.list(month));
  }
  
  async getDiary(date: string) {
    return this.client.get(APIEndpoints.diaries.byDate(date));
  }
  
  async saveDiaryMessage(data: any) {
    return this.client.post(APIEndpoints.diaries.messages(), { data });
  }
  
  async getDiaryMessages(date: string) {
    return this.client.get(APIEndpoints.diaries.messages(date));
  }
  
  // AI endpoints
  async chatWithAI(data: any) {
    return this.client.post(APIEndpoints.ai.chat(), { data });
  }
  
  async transcribeAudio(formData: FormData) {
    return this.client.post(APIEndpoints.ai.transcribe(), { data: formData });
  }
  
  async textToSpeech(data: any) {
    return this.client.post(APIEndpoints.ai.tts(), { data });
  }
  
  // Action endpoints
  async saveDiary(data: any) {
    return this.client.post(APIEndpoints.actions.saveDiary(), { data });
  }
  
  async deleteDiary(diaryId: number) {
    return this.client.delete(`/api/diaries/${diaryId}`);
  }
}

/**
 * Default typed API client instance
 */
export const typedAPIClient = new TypedAPIClient();
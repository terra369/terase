/**
 * Service Worker Error Handling and Resilience
 * Comprehensive error handling with fallback strategies
 */

interface ErrorContext {
  type: 'cache' | 'network' | 'sync' | 'storage' | 'unknown';
  operation: string;
  url?: string;
  method?: string;
  timestamp: number;
  retryable: boolean;
}

interface ErrorLog {
  id: string;
  error: Error;
  context: ErrorContext;
  resolved: boolean;
  resolvedAt?: number;
}

class ServiceWorkerErrorHandler {
  private readonly ERROR_LOG_KEY = 'terase_sw_errors';
  private readonly MAX_ERROR_LOGS = 100;
  private readonly RETRY_DELAYS = [1000, 5000, 15000, 30000]; // Exponential backoff

  /**
   * Handle service worker errors gracefully
   */
  async handleSWError(error: Error, context: Partial<ErrorContext> = {}): Promise<void> {
    try {
      const errorContext: ErrorContext = {
        type: context.type || 'unknown',
        operation: context.operation || 'unknown',
        url: context.url,
        method: context.method,
        timestamp: Date.now(),
        retryable: context.retryable ?? this.isRetryableError(error),
      };

      // Log the error
      await this.logSWError(error, errorContext);

      // Handle specific error types
      switch (errorContext.type) {
        case 'cache':
          await this.handleCacheError(error, errorContext);
          break;
        case 'network':
          await this.handleNetworkError(error, errorContext);
          break;
        case 'sync':
          await this.handleSyncError(error, errorContext);
          break;
        case 'storage':
          await this.handleStorageError(error, errorContext);
          break;
        default:
          await this.handleGenericError(error, errorContext);
      }
    } catch (handlingError) {
      console.error('Error handling failed:', handlingError);
    }
  }

  /**
   * Handle cache-related errors
   */
  async handleCacheError(url: string, context: Partial<ErrorContext> = {}): Promise<Response> {
    try {
      console.warn(`Cache error for ${url}:`, context);

      // Try different fallback strategies
      
      // 1. Try alternative cache
      const alternativeResponse = await this.tryAlternativeCache(url);
      if (alternativeResponse) {
        return alternativeResponse;
      }

      // 2. Try network as fallback
      if (navigator.onLine) {
        try {
          const networkResponse = await fetch(url);
          if (networkResponse.ok) {
            return networkResponse;
          }
        } catch (networkError) {
          console.log('Network fallback also failed:', networkError);
        }
      }

      // 3. Return appropriate fallback response
      return this.getFallbackResponse(url);
    } catch (error) {
      console.error('Cache error handling failed:', error);
      return this.getErrorResponse('Cache Error', 503);
    }
  }

  /**
   * Log service worker errors
   */
  async logSWError(error: Error, context: ErrorContext | string): Promise<void> {
    try {
      const errorLog: ErrorLog = {
        id: this.generateErrorId(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } as Error,
        context: typeof context === 'string' ? {
          type: 'unknown',
          operation: context,
          timestamp: Date.now(),
          retryable: false,
        } : context,
        resolved: false,
      };

      // Get existing logs
      const logs = await this.getErrorLogs();
      logs.push(errorLog);

      // Keep only recent logs
      if (logs.length > this.MAX_ERROR_LOGS) {
        logs.splice(0, logs.length - this.MAX_ERROR_LOGS);
      }

      // Save logs
      localStorage.setItem(this.ERROR_LOG_KEY, JSON.stringify(logs));

      // Console log for debugging
      console.error(`SW Error [${errorLog.id}]:`, {
        error: error.message,
        context: errorLog.context,
        stack: error.stack,
      });
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  /**
   * Get error logs
   */
  async getErrorLogs(): Promise<ErrorLog[]> {
    try {
      const stored = localStorage.getItem(this.ERROR_LOG_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get error logs:', error);
      return [];
    }
  }

  /**
   * Mark error as resolved
   */
  async markErrorResolved(errorId: string): Promise<void> {
    try {
      const logs = await this.getErrorLogs();
      const errorLog = logs.find(log => log.id === errorId);
      
      if (errorLog) {
        errorLog.resolved = true;
        errorLog.resolvedAt = Date.now();
        localStorage.setItem(this.ERROR_LOG_KEY, JSON.stringify(logs));
      }
    } catch (error) {
      console.error('Failed to mark error as resolved:', error);
    }
  }

  /**
   * Clear error logs
   */
  async clearErrorLogs(): Promise<void> {
    try {
      localStorage.removeItem(this.ERROR_LOG_KEY);
      console.log('Error logs cleared');
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(): Promise<{
    totalErrors: number;
    unresolvedErrors: number;
    errorsByType: Record<string, number>;
    errorsByOperation: Record<string, number>;
    recentErrors: number;
    averageResolutionTime: number;
  }> {
    try {
      const logs = await this.getErrorLogs();
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const stats = {
        totalErrors: logs.length,
        unresolvedErrors: logs.filter(log => !log.resolved).length,
        errorsByType: {} as Record<string, number>,
        errorsByOperation: {} as Record<string, number>,
        recentErrors: logs.filter(log => log.context.timestamp > oneHourAgo).length,
        averageResolutionTime: 0,
      };

      // Count by type and operation
      logs.forEach(log => {
        const type = log.context.type;
        const operation = log.context.operation;
        
        stats.errorsByType[type] = (stats.errorsByType[type] || 0) + 1;
        stats.errorsByOperation[operation] = (stats.errorsByOperation[operation] || 0) + 1;
      });

      // Calculate average resolution time
      const resolvedLogs = logs.filter(log => log.resolved && log.resolvedAt);
      if (resolvedLogs.length > 0) {
        const totalResolutionTime = resolvedLogs.reduce((sum, log) => {
          return sum + ((log.resolvedAt! - log.context.timestamp));
        }, 0);
        stats.averageResolutionTime = totalResolutionTime / resolvedLogs.length;
      }

      return stats;
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return {
        totalErrors: 0,
        unresolvedErrors: 0,
        errorsByType: {},
        errorsByOperation: {},
        recentErrors: 0,
        averageResolutionTime: 0,
      };
    }
  }

  /**
   * Retry failed operation with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    context: string = 'unknown'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.RETRY_DELAYS[Math.min(attempt - 1, this.RETRY_DELAYS.length - 1)];
          await this.sleep(delay);
          console.log(`Retrying operation: ${context} (attempt ${attempt}/${maxRetries})`);
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Operation failed: ${context} (attempt ${attempt + 1}/${maxRetries + 1})`, error);
      }
    }

    // All retries failed
    throw lastError || new Error(`Operation failed after ${maxRetries} retries: ${context}`);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Network errors are usually retryable
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // Specific retryable error patterns
    const retryablePatterns = [
      'network error',
      'timeout',
      'connection',
      'temporarily unavailable',
      'service unavailable',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Try alternative cache
   */
  private async tryAlternativeCache(url: string): Promise<Response | null> {
    try {
      const cacheNames = await caches.keys();
      
      // Try different cache variations
      for (const cacheName of cacheNames) {
        try {
          const cache = await caches.open(cacheName);
          const response = await cache.match(url);
          if (response) {
            console.log(`Found alternative cache: ${cacheName}`);
            return response;
          }
        } catch (cacheError) {
          console.warn(`Alternative cache failed: ${cacheName}`, cacheError);
        }
      }

      return null;
    } catch (error) {
      console.error('Alternative cache search failed:', error);
      return null;
    }
  }

  /**
   * Get fallback response based on URL type
   */
  private getFallbackResponse(url: string): Response {
    if (url.includes('/api/')) {
      return this.getAPIFallbackResponse();
    } else if (url.includes('.html') || url.includes('/')) {
      return this.getHTMLFallbackResponse();
    } else if (url.includes('.json')) {
      return this.getJSONFallbackResponse();
    } else {
      return this.getGenericFallbackResponse();
    }
  }

  /**
   * Handle network errors
   */
  private async handleNetworkError(error: Error, context: ErrorContext): Promise<void> {
    console.warn('Network error:', error.message, context);
    
    // Queue request for background sync if applicable
    if (context.retryable && context.url && context.method) {
      try {
        const { queueFailedRequest } = await import('./backgroundSync');
        await queueFailedRequest({
          url: context.url,
          method: context.method,
          type: 'api',
        });
        console.log('Request queued for background sync due to network error');
      } catch (syncError) {
        console.error('Failed to queue request for background sync:', syncError);
      }
    }
  }

  /**
   * Handle sync errors
   */
  private async handleSyncError(error: Error, context: ErrorContext): Promise<void> {
    console.warn('Sync error:', error.message, context);
    
    // Could implement additional sync retry logic or user notification
  }

  /**
   * Handle storage errors
   */
  private async handleStorageError(error: Error, context: ErrorContext): Promise<void> {
    console.warn('Storage error:', error.message, context);
    
    // Try to clean up storage if quota exceeded
    if (error.message.includes('quota') || error.message.includes('storage')) {
      try {
        const { cleanupWhenQuotaExceeded } = await import('./storageManager');
        await cleanupWhenQuotaExceeded();
        console.log('Storage cleanup triggered due to storage error');
      } catch (cleanupError) {
        console.error('Storage cleanup failed:', cleanupError);
      }
    }
  }

  /**
   * Handle generic errors
   */
  private async handleGenericError(error: Error, context: ErrorContext): Promise<void> {
    console.warn('Generic error:', error.message, context);
    // Default error handling
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get API fallback response
   */
  private getAPIFallbackResponse(): Response {
    return new Response(
      JSON.stringify({ 
        error: 'Service temporarily unavailable', 
        offline: true,
        timestamp: Date.now(),
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get HTML fallback response
   */
  private getHTMLFallbackResponse(): Response {
    return new Response(
      `<!DOCTYPE html>
       <html><head><title>オフライン</title></head>
       <body><h1>オフライン</h1><p>接続を確認してください</p></body></html>`,
      {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  /**
   * Get JSON fallback response
   */
  private getJSONFallbackResponse(): Response {
    return new Response(
      JSON.stringify({ error: 'Resource not available offline' }),
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get generic fallback response
   */
  private getGenericFallbackResponse(): Response {
    return new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  /**
   * Get error response
   */
  private getErrorResponse(message: string, status: number): Response {
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        statusText: message,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Create singleton instance
const errorHandler = new ServiceWorkerErrorHandler();

// Export functions for compatibility with tests
export const handleSWError = (error: Error, context?: Partial<ErrorContext>) =>
  errorHandler.handleSWError(error, context);

export const handleCacheError = (url: string, context?: Partial<ErrorContext>) =>
  errorHandler.handleCacheError(url, context);

export const logSWError = (error: Error, context: ErrorContext | string) =>
  errorHandler.logSWError(error, context);

export const getErrorLogs = () => errorHandler.getErrorLogs();
export const markErrorResolved = (errorId: string) => errorHandler.markErrorResolved(errorId);
export const clearErrorLogs = () => errorHandler.clearErrorLogs();
export const getErrorStats = () => errorHandler.getErrorStats();
export const retryWithBackoff = <T>(
  operation: () => Promise<T>,
  maxRetries?: number,
  context?: string
) => errorHandler.retryWithBackoff(operation, maxRetries, context);

// Export the error handler instance
export default errorHandler;
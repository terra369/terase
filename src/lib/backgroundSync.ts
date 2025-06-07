/**
 * Background Sync Implementation
 * Handles offline request queuing and retry when connectivity is restored
 */

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  type: 'diary' | 'audio' | 'api' | 'sync';
}

interface SyncResult {
  successful: number;
  failed: number;
  errors: string[];
}

interface SyncEvent {
  tag: string;
  lastChance?: boolean;
}

class BackgroundSyncManager {
  private readonly STORAGE_KEY = 'terase_queued_requests';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // Start with 1 second
  private readonly MAX_RETRY_DELAY = 60000; // Max 1 minute
  private isProcessing = false;

  /**
   * Register background sync
   */
  async registerSync(tag: string): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker is not supported');
      return;
    }

    if (typeof window !== 'undefined' && 
        window.ServiceWorkerRegistration && 
        !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('Background Sync is not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      console.log(`Background sync registered: ${tag}`);
    } catch (error) {
      console.error('Background sync registration failed:', error);
      throw error;
    }
  }

  /**
   * Queue a failed request for retry
   */
  async queueFailedRequest(request: Partial<QueuedRequest>): Promise<string> {
    try {
      const queuedRequest: QueuedRequest = {
        id: this.generateRequestId(),
        url: request.url || '',
        method: request.method || 'GET',
        headers: request.headers || {},
        body: request.body,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: request.maxRetries || this.MAX_RETRIES,
        type: request.type || 'api',
      };

      const queue = await this.getQueuedRequests();
      queue.push(queuedRequest);
      await this.saveQueuedRequests(queue);

      console.log(`Request queued for retry: ${queuedRequest.method} ${queuedRequest.url}`);
      
      // Try to register background sync
      await this.registerSync(`${queuedRequest.type}-sync`);
      
      return queuedRequest.id;
    } catch (error) {
      console.error('Failed to queue request:', error);
      throw error;
    }
  }

  /**
   * Get all queued requests
   */
  async getQueuedRequests(): Promise<QueuedRequest[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get queued requests:', error);
      return [];
    }
  }

  /**
   * Save queued requests to storage
   */
  private async saveQueuedRequests(requests: QueuedRequest[]): Promise<void> {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(requests));
    } catch (error) {
      console.error('Failed to save queued requests:', error);
      throw error;
    }
  }

  /**
   * Retry all queued requests
   */
  async retryQueuedRequests(): Promise<number> {
    if (this.isProcessing) {
      console.log('Background sync already in progress');
      return 0;
    }

    this.isProcessing = true;
    let processedCount = 0;

    try {
      const queue = await this.getQueuedRequests();
      const remainingRequests: QueuedRequest[] = [];

      for (const request of queue) {
        try {
          const success = await this.retryRequest(request);
          
          if (success) {
            console.log(`Request retry successful: ${request.method} ${request.url}`);
            processedCount++;
          } else {
            // Increment retry count
            request.retryCount++;
            
            if (request.retryCount < request.maxRetries) {
              remainingRequests.push(request);
              console.log(`Request retry failed, will retry again: ${request.method} ${request.url} (${request.retryCount}/${request.maxRetries})`);
            } else {
              console.error(`Request retry failed permanently: ${request.method} ${request.url}`);
              // Could trigger error notification to user
            }
          }
        } catch (error) {
          console.error(`Error processing queued request:`, error);
          request.retryCount++;
          if (request.retryCount < request.maxRetries) {
            remainingRequests.push(request);
          }
        }
      }

      // Save remaining requests
      await this.saveQueuedRequests(remainingRequests);
      
      console.log(`Background sync completed: ${processedCount} requests processed, ${remainingRequests.length} remaining`);
      return processedCount;
    } catch (error) {
      console.error('Background sync failed:', error);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a single request
   */
  private async retryRequest(request: QueuedRequest): Promise<boolean> {
    try {
      const delay = Math.min(
        this.RETRY_DELAY * Math.pow(2, request.retryCount),
        this.MAX_RETRY_DELAY
      );
      
      // Add jitter to avoid thundering herd
      await this.sleep(delay + Math.random() * 1000);

      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      return response.ok;
    } catch (error) {
      console.error(`Request retry failed: ${request.method} ${request.url}`, error);
      return false;
    }
  }

  /**
   * Handle sync event (called by service worker)
   */
  async handleSyncEvent(event: SyncEvent): Promise<SyncResult> {
    console.log(`Handling sync event: ${event.tag}`);
    
    const result: SyncResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      const queue = await this.getQueuedRequests();
      const filteredQueue = event.tag === 'diary-sync' 
        ? queue.filter(req => req.type === 'diary' || req.type === 'audio')
        : queue;

      const remainingRequests: QueuedRequest[] = [];

      for (const request of filteredQueue) {
        try {
          const success = await this.retryRequest(request);
          
          if (success) {
            result.successful++;
          } else {
            request.retryCount++;
            
            if (request.retryCount < request.maxRetries && !event.lastChance) {
              remainingRequests.push(request);
            } else {
              result.failed++;
              result.errors.push(`Failed to sync: ${request.method} ${request.url}`);
            }
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Error syncing: ${error.message}`);
        }
      }

      // Update queue with remaining requests
      const otherRequests = queue.filter(req => 
        event.tag === 'diary-sync' 
          ? req.type !== 'diary' && req.type !== 'audio'
          : false
      );
      
      await this.saveQueuedRequests([...otherRequests, ...remainingRequests]);

    } catch (error) {
      console.error('Sync event handling failed:', error);
      result.errors.push(`Sync event failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Clear all queued requests
   */
  async clearQueue(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('Request queue cleared');
    } catch (error) {
      console.error('Failed to clear queue:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    totalRequests: number;
    requestsByType: Record<string, number>;
    requestsByMethod: Record<string, number>;
    oldestRequest?: Date;
    averageRetryCount: number;
  }> {
    try {
      const queue = await this.getQueuedRequests();
      const requestsByType: Record<string, number> = {};
      const requestsByMethod: Record<string, number> = {};
      let totalRetries = 0;
      let oldestTimestamp = Date.now();

      for (const request of queue) {
        requestsByType[request.type] = (requestsByType[request.type] || 0) + 1;
        requestsByMethod[request.method] = (requestsByMethod[request.method] || 0) + 1;
        totalRetries += request.retryCount;
        oldestTimestamp = Math.min(oldestTimestamp, request.timestamp);
      }

      return {
        totalRequests: queue.length,
        requestsByType,
        requestsByMethod,
        oldestRequest: queue.length > 0 ? new Date(oldestTimestamp) : undefined,
        averageRetryCount: queue.length > 0 ? totalRetries / queue.length : 0,
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return {
        totalRequests: 0,
        requestsByType: {},
        requestsByMethod: {},
        averageRetryCount: 0,
      };
    }
  }

  /**
   * Queue specific types of requests
   */
  async queueDiaryRequest(url: string, method: string, data: any): Promise<string> {
    return this.queueFailedRequest({
      url,
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      type: 'diary',
      maxRetries: 5, // Higher retry count for important diary data
    });
  }

  async queueAudioUpload(url: string, formData: FormData): Promise<string> {
    // Note: FormData can't be serialized directly, so we need special handling
    const serializedData = await this.serializeFormData(formData);
    
    return this.queueFailedRequest({
      url,
      method: 'POST',
      headers: {}, // Don't set Content-Type for FormData, let browser handle it
      body: serializedData,
      type: 'audio',
      maxRetries: 3,
    });
  }

  /**
   * Auto-retry when online
   */
  setupAutoRetry(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', async () => {
        console.log('Connectivity restored, retrying queued requests');
        await this.retryQueuedRequests();
      });
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serialize FormData for storage
   */
  private async serializeFormData(formData: FormData): Promise<string> {
    const serialized: Record<string, any> = {};
    
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // Convert File to base64 for storage
        const buffer = await value.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        serialized[key] = {
          type: 'file',
          name: value.name,
          mimeType: value.type,
          data: base64,
        };
      } else {
        serialized[key] = value;
      }
    }
    
    return JSON.stringify(serialized);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const backgroundSyncManager = new BackgroundSyncManager();

// Export functions for compatibility with tests
export const registerSync = (tag: string) => backgroundSyncManager.registerSync(tag);
export const queueFailedRequest = (request: Partial<QueuedRequest>) => 
  backgroundSyncManager.queueFailedRequest(request);
export const getQueuedRequests = () => backgroundSyncManager.getQueuedRequests();
export const retryQueuedRequests = () => backgroundSyncManager.retryQueuedRequests();
export const handleSyncEvent = (event: SyncEvent) => backgroundSyncManager.handleSyncEvent(event);
export const clearQueue = () => backgroundSyncManager.clearQueue();
export const getQueueStats = () => backgroundSyncManager.getQueueStats();
export const queueDiaryRequest = (url: string, method: string, data: any) =>
  backgroundSyncManager.queueDiaryRequest(url, method, data);
export const queueAudioUpload = (url: string, formData: FormData) =>
  backgroundSyncManager.queueAudioUpload(url, formData);

// Auto-setup retry on module load
if (typeof window !== 'undefined') {
  backgroundSyncManager.setupAutoRetry();
}

// Export the manager instance
export default backgroundSyncManager;
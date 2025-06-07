/**
 * Service Worker Event Handlers
 * Custom event handling for install, activate, fetch, and sync events
 */

interface InstallEvent extends ExtendableEvent {
  waitUntil(promise: Promise<any>): void;
}

interface ActivateEvent extends ExtendableEvent {
  waitUntil(promise: Promise<any>): void;
}

interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
  waitUntil(promise: Promise<any>): void;
}

interface SyncEvent extends ExtendableEvent {
  tag: string;
  lastChance: boolean;
  waitUntil(promise: Promise<any>): void;
}

class ServiceWorkerEventHandlers {
  private readonly CACHE_VERSION = 'v1.8.0';
  private readonly OFFLINE_URL = '/offline.html';
  
  /**
   * Handle service worker install event
   */
  async handleInstall(event: InstallEvent): Promise<void> {
    console.log('Service Worker installing...');
    
    event.waitUntil(
      this.performInstallTasks()
    );
  }

  /**
   * Handle service worker activate event
   */
  async handleActivate(event: ActivateEvent): Promise<void> {
    console.log('Service Worker activating...');
    
    event.waitUntil(Promise.all([
      this.cleanupOldCaches(),
      this.claimClients(),
    ]));
  }

  /**
   * Handle fetch requests with fallback strategies
   */
  async handleFetch(event: FetchEvent): Promise<void> {
    const request = event.request;
    
    // Handle different types of requests
    if (this.isNavigationRequest(request)) {
      event.respondWith(this.handleNavigationRequest(request));
    } else if (this.isAPIRequest(request)) {
      event.respondWith(this.handleAPIRequest(request));
    } else if (this.isAudioRequest(request)) {
      event.respondWith(this.handleAudioRequest(request));
    } else {
      event.respondWith(this.handleStaticRequest(request));
    }
  }

  /**
   * Handle sync events for background sync
   */
  async handleSyncEvent(event: SyncEvent): Promise<void> {
    console.log('Background sync event:', event.tag);
    
    if (event.tag === 'diary-sync') {
      event.waitUntil(this.syncDiaryData(event.lastChance));
    } else if (event.tag === 'audio-sync') {
      event.waitUntil(this.syncAudioData(event.lastChance));
    } else {
      event.waitUntil(this.syncGenericData(event.tag, event.lastChance));
    }
  }

  /**
   * Perform installation tasks
   */
  private async performInstallTasks(): Promise<void> {
    try {
      // Pre-cache critical resources
      const cache = await caches.open(`critical-${this.CACHE_VERSION}`);
      await cache.addAll([
        '/',
        this.OFFLINE_URL,
        '/manifest.json',
        '/favicon.ico',
      ]);

      // Skip waiting to activate immediately
      self.skipWaiting();
      
      console.log('Service Worker installation completed');
    } catch (error) {
      console.error('Service Worker installation failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old cache versions
   */
  private async cleanupOldCaches(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.includes('critical-') && !name.includes(this.CACHE_VERSION)
      );

      await Promise.all(
        oldCaches.map(cacheName => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }

  /**
   * Claim all clients
   */
  private async claimClients(): Promise<void> {
    try {
      await (self as any).clients.claim();
      console.log('Service Worker claimed all clients');
    } catch (error) {
      console.error('Failed to claim clients:', error);
    }
  }

  /**
   * Handle navigation requests (HTML pages)
   */
  private async handleNavigationRequest(request: Request): Promise<Response> {
    try {
      // Try network first
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        return networkResponse;
      }
      
      throw new Error(`Network response not ok: ${networkResponse.status}`);
    } catch (error) {
      console.log('Navigation request failed, serving offline page:', request.url);
      
      // Serve offline page for navigation requests
      const cache = await caches.open(`critical-${this.CACHE_VERSION}`);
      const offlineResponse = await cache.match(this.OFFLINE_URL);
      
      if (offlineResponse) {
        return offlineResponse;
      }
      
      // Fallback to a simple offline response
      return new Response(
        this.getOfflineFallbackHTML(),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }
  }

  /**
   * Handle API requests with caching and background sync
   */
  private async handleAPIRequest(request: Request): Promise<Response> {
    const url = request.url;
    const method = request.method;
    
    try {
      // For GET requests, try cache first for faster response
      if (method === 'GET') {
        const cachedResponse = await this.getCachedAPIResponse(url, method);
        if (cachedResponse) {
          // Return cached response and update in background
          this.updateAPICache(request);
          return cachedResponse;
        }
      }
      
      // Try network
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        // Cache successful GET responses
        if (method === 'GET') {
          await this.cacheAPIResponse(url, networkResponse.clone(), method);
        }
        
        return networkResponse;
      }
      
      throw new Error(`API request failed: ${networkResponse.status}`);
    } catch (error) {
      console.log('API request failed:', url, error);
      
      // For GET requests, try to serve from cache
      if (method === 'GET') {
        const cachedResponse = await this.getCachedAPIResponse(url, method);
        if (cachedResponse) {
          return cachedResponse;
        }
      }
      
      // For POST/PUT/DELETE requests, queue for background sync
      if (['POST', 'PUT', 'DELETE'].includes(method)) {
        await this.queueFailedRequest(request);
      }
      
      // Return error response
      return new Response(
        JSON.stringify({ error: 'Request failed and no cached data available' }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Handle audio file requests with dedicated caching
   */
  private async handleAudioRequest(request: Request): Promise<Response> {
    try {
      // Try cache first for audio files
      const cachedResponse = await this.getCachedAudioResponse(request.url);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Try network
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        // Cache audio file
        await this.cacheAudioResponse(request.url, networkResponse.clone());
        return networkResponse;
      }
      
      throw new Error(`Audio request failed: ${networkResponse.status}`);
    } catch (error) {
      console.log('Audio request failed:', request.url, error);
      
      // Return error for audio requests
      return new Response(null, {
        status: 404,
        statusText: 'Audio Not Found',
      });
    }
  }

  /**
   * Handle static resource requests
   */
  private async handleStaticRequest(request: Request): Promise<Response> {
    try {
      // Use existing cache strategy from next-pwa
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Fetch from network
      return await fetch(request);
    } catch (error) {
      console.log('Static request failed:', request.url, error);
      
      // Return minimal error response
      return new Response(null, {
        status: 404,
        statusText: 'Not Found',
      });
    }
  }

  /**
   * Sync diary data
   */
  private async syncDiaryData(lastChance: boolean): Promise<void> {
    try {
      // Import background sync manager and handle diary sync
      const { handleSyncEvent } = await import('./backgroundSync');
      await handleSyncEvent({ tag: 'diary-sync', lastChance });
      
      console.log('Diary data sync completed');
    } catch (error) {
      console.error('Diary data sync failed:', error);
      if (lastChance) {
        throw error; // Let the browser know sync failed
      }
    }
  }

  /**
   * Sync audio data
   */
  private async syncAudioData(lastChance: boolean): Promise<void> {
    try {
      const { handleSyncEvent } = await import('./backgroundSync');
      await handleSyncEvent({ tag: 'audio-sync', lastChance });
      
      console.log('Audio data sync completed');
    } catch (error) {
      console.error('Audio data sync failed:', error);
      if (lastChance) {
        throw error;
      }
    }
  }

  /**
   * Sync generic data
   */
  private async syncGenericData(tag: string, lastChance: boolean): Promise<void> {
    try {
      const { handleSyncEvent } = await import('./backgroundSync');
      await handleSyncEvent({ tag, lastChance });
      
      console.log(`Generic sync completed: ${tag}`);
    } catch (error) {
      console.error(`Generic sync failed: ${tag}`, error);
      if (lastChance) {
        throw error;
      }
    }
  }

  /**
   * Check if request is for navigation
   */
  private isNavigationRequest(request: Request): boolean {
    return request.mode === 'navigate' || 
           (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
  }

  /**
   * Check if request is for API
   */
  private isAPIRequest(request: Request): boolean {
    return request.url.includes('/api/');
  }

  /**
   * Check if request is for audio
   */
  private isAudioRequest(request: Request): boolean {
    return request.url.includes('.wav') || 
           request.url.includes('.mp3') || 
           request.url.includes('.ogg') ||
           request.headers.get('accept')?.includes('audio/');
  }

  /**
   * Get cached API response
   */
  private async getCachedAPIResponse(url: string, method: string): Promise<Response | null> {
    try {
      const { getAPIResponse } = await import('./api/cacheStrategy');
      return await getAPIResponse(url, method);
    } catch (error) {
      console.error('Failed to get cached API response:', error);
      return null;
    }
  }

  /**
   * Cache API response
   */
  private async cacheAPIResponse(url: string, response: Response, method: string): Promise<void> {
    try {
      const { cacheAPIResponse } = await import('./api/cacheStrategy');
      await cacheAPIResponse(url, response, method);
    } catch (error) {
      console.error('Failed to cache API response:', error);
    }
  }

  /**
   * Update API cache in background
   */
  private async updateAPICache(request: Request): Promise<void> {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await this.cacheAPIResponse(request.url, response, request.method);
      }
    } catch (error) {
      console.log('Background API cache update failed:', error);
    }
  }

  /**
   * Get cached audio response
   */
  private async getCachedAudioResponse(url: string): Promise<Response | null> {
    try {
      const { getAudioFromCache } = await import('./audio/audioCache');
      const audioBlob = await getAudioFromCache(url);
      
      if (audioBlob) {
        return new Response(audioBlob, {
          headers: {
            'Content-Type': audioBlob.type || 'audio/wav',
            'Content-Length': audioBlob.size.toString(),
          },
        });
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached audio:', error);
      return null;
    }
  }

  /**
   * Cache audio response
   */
  private async cacheAudioResponse(url: string, response: Response): Promise<void> {
    try {
      const { cacheAudioFile } = await import('./audio/audioCache');
      const audioBlob = await response.blob();
      await cacheAudioFile(url, audioBlob);
    } catch (error) {
      console.error('Failed to cache audio:', error);
    }
  }

  /**
   * Queue failed request for background sync
   */
  private async queueFailedRequest(request: Request): Promise<void> {
    try {
      const { queueFailedRequest } = await import('./backgroundSync');
      
      const body = request.method !== 'GET' ? await request.text() : undefined;
      const headers: Record<string, string> = {};
      
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      await queueFailedRequest({
        url: request.url,
        method: request.method,
        headers,
        body,
        type: 'api',
      });
      
      console.log('Request queued for background sync:', request.method, request.url);
    } catch (error) {
      console.error('Failed to queue request:', error);
    }
  }

  /**
   * Get offline fallback HTML
   */
  private getOfflineFallbackHTML(): string {
    return `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>オフライン - terase</title>
        <style>
          body { 
            font-family: sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #1a1a1a; 
            color: #fff; 
          }
          .container { 
            max-width: 400px; 
            margin: 0 auto; 
          }
          button { 
            background: #4ecdc4; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            cursor: pointer; 
            margin-top: 20px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>オフライン</h1>
          <p>インターネット接続を確認してください</p>
          <button onclick="location.reload()">再試行</button>
        </div>
      </body>
      </html>
    `;
  }
}

// Create singleton instance
const eventHandlers = new ServiceWorkerEventHandlers();

// Export event handler functions
export const handleInstall = (event: InstallEvent) => eventHandlers.handleInstall(event);
export const handleActivate = (event: ActivateEvent) => eventHandlers.handleActivate(event);
export const handleFetch = (event: FetchEvent) => eventHandlers.handleFetch(event);
export const handleSyncEvent = (event: SyncEvent) => eventHandlers.handleSyncEvent(event);

// Export the handlers instance
export default eventHandlers;
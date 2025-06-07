/**
 * Enhanced API Response Caching Strategy
 * Smart caching for API responses with invalidation and TTL management
 */

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  methods: string[]; // HTTP methods to cache
  headers?: Record<string, string>; // Additional headers to add
  invalidatePatterns?: string[]; // Patterns to invalidate when this endpoint is updated
}

interface CachedResponse {
  response: Response;
  timestamp: number;
  ttl: number;
  url: string;
  method: string;
}

class APICacheStrategy {
  private readonly CACHE_NAME = 'api-cache';
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Cache configuration for different endpoint patterns
  private readonly CACHE_CONFIGS: Record<string, CacheConfig> = {
    '/api/diaries': {
      ttl: 10 * 60 * 1000, // 10 minutes
      methods: ['GET'],
      invalidatePatterns: ['/api/diaries/messages', '/api/actions/saveDiary'],
    },
    '/api/diaries/[date]': {
      ttl: 30 * 60 * 1000, // 30 minutes
      methods: ['GET'],
      invalidatePatterns: ['/api/diaries/messages', '/api/actions/saveDiary'],
    },
    '/api/diaries/messages': {
      ttl: 2 * 60 * 1000, // 2 minutes
      methods: ['GET'],
      invalidatePatterns: [],
    },
    '/api/transcribe': {
      ttl: 60 * 60 * 1000, // 1 hour
      methods: ['POST'], // Cache transcription results
    },
    '/api/tts': {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      methods: ['POST'], // Cache TTS responses
    },
  };

  /**
   * Cache API response with metadata
   */
  async cacheAPIResponse(url: string, response: Response, method: string = 'GET'): Promise<void> {
    try {
      if (!this.shouldCacheResponse(url, method, response)) {
        return;
      }

      const config = this.getConfigForURL(url);
      const cache = await caches.open(this.CACHE_NAME);
      
      // Clone response to avoid consuming it
      const responseClone = response.clone();
      
      // Add cache metadata headers
      const headers = new Headers(responseClone.headers);
      headers.set('Cache-Timestamp', Date.now().toString());
      headers.set('Cache-TTL', config.ttl.toString());
      headers.set('Cache-Method', method);
      headers.set('Cache-URL', url);

      // Add custom headers if configured
      if (config.headers) {
        Object.entries(config.headers).forEach(([key, value]) => {
          headers.set(key, value);
        });
      }

      const cachedResponse = new Response(await responseClone.arrayBuffer(), {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers,
      });

      const cacheKey = this.generateCacheKey(url, method);
      await cache.put(cacheKey, cachedResponse);
      
      console.log(`API response cached: ${method} ${url} (TTL: ${config.ttl}ms)`);
    } catch (error) {
      console.error('Failed to cache API response:', error);
    }
  }

  /**
   * Get API response from cache
   */
  async getAPIResponse(url: string, method: string = 'GET'): Promise<Response | null> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const cacheKey = this.generateCacheKey(url, method);
      const cachedResponse = await cache.match(cacheKey);

      if (!cachedResponse) {
        return null;
      }

      // Check if cache entry is expired
      const timestamp = cachedResponse.headers.get('Cache-Timestamp');
      const ttl = cachedResponse.headers.get('Cache-TTL');

      if (timestamp && ttl) {
        const age = Date.now() - parseInt(timestamp);
        if (age > parseInt(ttl)) {
          // Entry expired, remove it
          await cache.delete(cacheKey);
          console.log(`Expired cache entry removed: ${method} ${url}`);
          return null;
        }
      }

      console.log(`API response retrieved from cache: ${method} ${url}`);
      return cachedResponse;
    } catch (error) {
      console.error('Failed to get API response from cache:', error);
      return null;
    }
  }

  /**
   * Check if response should be cached
   */
  shouldCacheResponse(url: string, method: string, response: Response): boolean {
    // Don't cache error responses
    if (!response.ok) {
      return false;
    }

    // Don't cache if response has no-cache directive
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl && cacheControl.includes('no-cache')) {
      return false;
    }

    const config = this.getConfigForURL(url);
    return config.methods.includes(method.toUpperCase());
  }

  /**
   * Invalidate cache for specific URL
   */
  async invalidateAPICache(url: string, method?: string): Promise<void> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      
      if (method) {
        // Invalidate specific method
        const cacheKey = this.generateCacheKey(url, method);
        await cache.delete(cacheKey);
        console.log(`Cache invalidated: ${method} ${url}`);
      } else {
        // Invalidate all methods for this URL
        const allKeys = await cache.keys();
        const urlPattern = this.normalizeURL(url);
        
        for (const request of allKeys) {
          if (request.url.includes(urlPattern)) {
            await cache.delete(request);
          }
        }
        console.log(`All cache entries invalidated for: ${url}`);
      }
    } catch (error) {
      console.error('Failed to invalidate API cache:', error);
    }
  }

  /**
   * Invalidate related APIs based on patterns
   */
  async invalidateRelatedAPIs(url: string): Promise<void> {
    try {
      // Find which endpoint patterns this URL affects
      const affectedPatterns: string[] = [];
      
      Object.entries(this.CACHE_CONFIGS).forEach(([pattern, config]) => {
        if (config.invalidatePatterns?.some(invalidatePattern => url.includes(invalidatePattern))) {
          affectedPatterns.push(pattern);
        }
      });

      // Also check for patterns that this URL should invalidate
      Object.entries(this.CACHE_CONFIGS).forEach(([pattern, config]) => {
        if (config.invalidatePatterns?.includes(url) || pattern.includes(url)) {
          affectedPatterns.push(pattern);
        }
      });

      // Invalidate cache for affected patterns
      const cache = await caches.open(this.CACHE_NAME);
      const allKeys = await cache.keys();
      let deletedCount = 0;

      for (const pattern of affectedPatterns) {
        const normalizedPattern = this.normalizeURL(pattern);
        
        for (const request of allKeys) {
          if (this.matchesPattern(request.url, normalizedPattern)) {
            await cache.delete(request);
            deletedCount++;
            console.log(`Related cache invalidated: ${request.url}`);
          }
        }
      }

      // If no patterns matched, try to invalidate by URL similarity
      if (deletedCount === 0) {
        const normalizedURL = this.normalizeURL(url);
        for (const request of allKeys) {
          if (request.url.includes(normalizedURL.split('/')[1])) { // Match by base path
            await cache.delete(request);
            deletedCount++;
            console.log(`URL-based cache invalidated: ${request.url}`);
          }
        }
      }

      console.log(`Invalidated ${deletedCount} related cache entries for: ${url}`);
    } catch (error) {
      console.error('Failed to invalidate related APIs:', error);
    }
  }

  /**
   * Clear all API cache
   */
  async clearAllAPICache(): Promise<void> {
    try {
      await caches.delete(this.CACHE_NAME);
      console.log('All API cache cleared');
    } catch (error) {
      console.error('Failed to clear API cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    entriesByMethod: Record<string, number>;
    entriesByPattern: Record<string, number>;
    averageAge: number;
  }> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const requests = await cache.keys();
      
      let totalSize = 0;
      const entriesByMethod: Record<string, number> = {};
      const entriesByPattern: Record<string, number> = {};
      const ages: number[] = [];

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          // Calculate size
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            totalSize += parseInt(contentLength);
          }

          // Count by method
          const method = response.headers.get('Cache-Method') || 'GET';
          entriesByMethod[method] = (entriesByMethod[method] || 0) + 1;

          // Count by pattern
          const pattern = this.getPatternForURL(request.url);
          entriesByPattern[pattern] = (entriesByPattern[pattern] || 0) + 1;

          // Calculate age
          const timestamp = response.headers.get('Cache-Timestamp');
          if (timestamp) {
            ages.push(Date.now() - parseInt(timestamp));
          }
        }
      }

      const averageAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

      return {
        totalEntries: requests.length,
        totalSize,
        entriesByMethod,
        entriesByPattern,
        averageAge,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        entriesByMethod: {},
        entriesByPattern: {},
        averageAge: 0,
      };
    }
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const requests = await cache.keys();
      let cleanedCount = 0;

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const timestamp = response.headers.get('Cache-Timestamp');
          const ttl = response.headers.get('Cache-TTL');

          if (timestamp && ttl) {
            const age = Date.now() - parseInt(timestamp);
            if (age > parseInt(ttl)) {
              await cache.delete(request);
              cleanedCount++;
            }
          }
        }
      }

      console.log(`Cleaned up ${cleanedCount} expired API cache entries`);
      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup expired entries:', error);
      return 0;
    }
  }

  /**
   * Get cache configuration for URL
   */
  private getConfigForURL(url: string): CacheConfig {
    const normalizedURL = this.normalizeURL(url);
    
    // Find matching pattern
    for (const [pattern, config] of Object.entries(this.CACHE_CONFIGS)) {
      if (this.matchesPattern(normalizedURL, pattern)) {
        return config;
      }
    }

    // Default configuration
    return {
      ttl: this.DEFAULT_TTL,
      methods: ['GET'],
    };
  }

  /**
   * Get pattern for URL (for statistics)
   */
  private getPatternForURL(url: string): string {
    const normalizedURL = this.normalizeURL(url);
    
    for (const pattern of Object.keys(this.CACHE_CONFIGS)) {
      if (this.matchesPattern(normalizedURL, pattern)) {
        return pattern;
      }
    }

    return 'unknown';
  }

  /**
   * Generate cache key for URL and method
   */
  private generateCacheKey(url: string, method: string): string {
    return `${method.toUpperCase()}:${this.normalizeURL(url)}`;
  }

  /**
   * Normalize URL for consistent matching
   */
  private normalizeURL(url: string): string {
    // Remove protocol and domain if present
    const urlObj = new URL(url, 'https://example.com');
    return urlObj.pathname + urlObj.search;
  }

  /**
   * Check if URL matches pattern (supports [param] placeholders)
   */
  private matchesPattern(url: string, pattern: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\[([^\]]+)\]/g, '[^/]+') // Replace [param] with regex
      .replace(/\//g, '\\/'); // Escape slashes
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  }
}

// Create singleton instance
const apiCacheStrategy = new APICacheStrategy();

// Export functions for compatibility with tests
export const cacheAPIResponse = (url: string, response: Response, method?: string) =>
  apiCacheStrategy.cacheAPIResponse(url, response, method);

export const getAPIResponse = (url: string, method?: string) =>
  apiCacheStrategy.getAPIResponse(url, method);

export const shouldCacheResponse = (url: string, method: string, response: Response) =>
  apiCacheStrategy.shouldCacheResponse(url, method, response);

export const invalidateAPICache = (url: string, method?: string) =>
  apiCacheStrategy.invalidateAPICache(url, method);

export const invalidateRelatedAPIs = (url: string) =>
  apiCacheStrategy.invalidateRelatedAPIs(url);

export const clearAllAPICache = () =>
  apiCacheStrategy.clearAllAPICache();

export const getCacheStats = () =>
  apiCacheStrategy.getCacheStats();

export const cleanupExpiredEntries = () =>
  apiCacheStrategy.cleanupExpiredEntries();

// Export the strategy instance
export default apiCacheStrategy;
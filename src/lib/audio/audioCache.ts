/**
 * Enhanced Audio File Caching System
 * Specialized caching for voice diary audio files with quota management
 */

interface AudioCacheEntry {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
  metadata?: {
    duration?: number;
    type: string;
    diaryId?: string;
    userId?: string;
  };
}

interface CacheInfo {
  totalSize: number;
  totalEntries: number;
  entries: AudioCacheEntry[];
}

class AudioCacheManager {
  private readonly CACHE_NAME = 'diary-audio';
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_ENTRIES = 100;
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Cache an audio file with metadata
   */
  async cacheAudioFile(
    url: string, 
    blob: Blob, 
    metadata?: AudioCacheEntry['metadata']
  ): Promise<void> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      
      // Create enhanced response with metadata
      const headers = new Headers({
        'Content-Type': blob.type || 'audio/wav',
        'Content-Length': blob.size.toString(),
        'Cache-Timestamp': Date.now().toString(),
        'Cache-TTL': this.DEFAULT_TTL.toString(),
      });

      // Add metadata headers if provided
      if (metadata) {
        headers.set('Audio-Metadata', JSON.stringify(metadata));
      }

      const response = new Response(blob, { headers });
      
      // Check cache size before adding
      await this.ensureCacheSize(blob.size);
      
      await cache.put(url, response);
      console.log(`Audio cached: ${url} (${this.formatSize(blob.size)})`);
    } catch (error) {
      console.error('Failed to cache audio file:', error);
      throw error;
    }
  }

  /**
   * Retrieve audio file from cache
   */
  async getAudioFromCache(url: string): Promise<Blob | null> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const response = await cache.match(url);
      
      if (!response) {
        return null;
      }

      // Check if cache entry is expired
      const timestamp = response.headers.get('Cache-Timestamp');
      const ttl = response.headers.get('Cache-TTL');
      
      if (timestamp && ttl) {
        const age = Date.now() - parseInt(timestamp);
        if (age > parseInt(ttl)) {
          // Entry expired, remove it
          await cache.delete(url);
          return null;
        }
      }

      const blob = await response.blob();
      console.log(`Audio retrieved from cache: ${url}`);
      return blob;
    } catch (error) {
      console.error('Failed to retrieve audio from cache:', error);
      return null;
    }
  }

  /**
   * Get total cache size
   */
  async getAudioCacheSize(): Promise<number> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const requests = await cache.keys();
      let totalSize = 0;

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const contentLength = response.headers.get('Content-Length');
          if (contentLength) {
            totalSize += parseInt(contentLength);
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  /**
   * Get detailed cache information
   */
  async getCacheInfo(): Promise<CacheInfo> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const requests = await cache.keys();
      const entries: AudioCacheEntry[] = [];
      let totalSize = 0;

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const contentLength = response.headers.get('Content-Length');
          const timestamp = response.headers.get('Cache-Timestamp');
          const metadataHeader = response.headers.get('Audio-Metadata');
          
          const size = contentLength ? parseInt(contentLength) : 0;
          totalSize += size;

          entries.push({
            url: request.url,
            blob: await response.blob(),
            timestamp: timestamp ? parseInt(timestamp) : Date.now(),
            size,
            metadata: metadataHeader ? JSON.parse(metadataHeader) : undefined,
          });
        }
      }

      return {
        totalSize,
        totalEntries: entries.length,
        entries: entries.sort((a, b) => b.timestamp - a.timestamp), // Most recent first
      };
    } catch (error) {
      console.error('Failed to get cache info:', error);
      return { totalSize: 0, totalEntries: 0, entries: [] };
    }
  }

  /**
   * Evict old audio files using LRU strategy
   */
  async evictOldAudioFiles(targetReduction?: number): Promise<number> {
    try {
      const cacheInfo = await this.getCacheInfo();
      
      if (cacheInfo.totalEntries === 0) {
        return 0;
      }

      // Sort by timestamp (oldest first for eviction)
      const sortedEntries = cacheInfo.entries.sort((a, b) => a.timestamp - b.timestamp);
      
      let sizeToReduce = targetReduction || (cacheInfo.totalSize * 0.3); // Remove 30% by default
      let evictedSize = 0;
      let evictedCount = 0;

      const cache = await caches.open(this.CACHE_NAME);

      for (const entry of sortedEntries) {
        if (evictedSize >= sizeToReduce && evictedCount > 0) {
          break;
        }

        await cache.delete(entry.url);
        evictedSize += entry.size;
        evictedCount++;
        
        console.log(`Evicted audio: ${entry.url} (${this.formatSize(entry.size)})`);
      }

      console.log(`Cache cleanup completed: ${evictedCount} files, ${this.formatSize(evictedSize)} freed`);
      return evictedCount;
    } catch (error) {
      console.error('Failed to evict old audio files:', error);
      return 0;
    }
  }

  /**
   * Clear all audio cache
   */
  async clearAudioCache(): Promise<void> {
    try {
      await caches.delete(this.CACHE_NAME);
      console.log('Audio cache cleared completely');
    } catch (error) {
      console.error('Failed to clear audio cache:', error);
      throw error;
    }
  }

  /**
   * Check if URL is cached
   */
  async isAudioCached(url: string): Promise<boolean> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const response = await cache.match(url);
      return !!response;
    } catch (error) {
      console.error('Failed to check if audio is cached:', error);
      return false;
    }
  }

  /**
   * Prefetch and cache audio files
   */
  async prefetchAudioFiles(urls: string[]): Promise<number> {
    let successCount = 0;

    for (const url of urls) {
      try {
        // Check if already cached
        if (await this.isAudioCached(url)) {
          continue;
        }

        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          await this.cacheAudioFile(url, blob);
          successCount++;
        }
      } catch (error) {
        console.warn(`Failed to prefetch audio: ${url}`, error);
      }
    }

    console.log(`Prefetched ${successCount}/${urls.length} audio files`);
    return successCount;
  }

  /**
   * Ensure cache doesn't exceed size limits
   */
  private async ensureCacheSize(newEntrySize: number): Promise<void> {
    const currentSize = await this.getAudioCacheSize();
    const cacheInfo = await this.getCacheInfo();

    // Check if we need to free space
    const wouldExceedSize = (currentSize + newEntrySize) > this.MAX_CACHE_SIZE;
    const wouldExceedCount = cacheInfo.totalEntries >= this.MAX_ENTRIES;

    if (wouldExceedSize || wouldExceedCount) {
      const targetReduction = wouldExceedSize 
        ? (currentSize + newEntrySize - this.MAX_CACHE_SIZE + (this.MAX_CACHE_SIZE * 0.1)) // Add 10% buffer
        : undefined;

      await this.evictOldAudioFiles(targetReduction);
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    totalEntries: number;
    maxSize: number;
    maxEntries: number;
    utilizationPercentage: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    const cacheInfo = await this.getCacheInfo();
    
    const stats = {
      totalSize: cacheInfo.totalSize,
      totalEntries: cacheInfo.totalEntries,
      maxSize: this.MAX_CACHE_SIZE,
      maxEntries: this.MAX_ENTRIES,
      utilizationPercentage: (cacheInfo.totalSize / this.MAX_CACHE_SIZE) * 100,
    };

    if (cacheInfo.entries.length > 0) {
      const timestamps = cacheInfo.entries.map(e => e.timestamp);
      return {
        ...stats,
        oldestEntry: new Date(Math.min(...timestamps)),
        newestEntry: new Date(Math.max(...timestamps)),
      };
    }

    return stats;
  }
}

// Create singleton instance
const audioCacheManager = new AudioCacheManager();

// Export functions for compatibility with tests
export const cacheAudioFile = (url: string, blob: Blob, metadata?: any) => 
  audioCacheManager.cacheAudioFile(url, blob, metadata);

export const getAudioFromCache = (url: string) => 
  audioCacheManager.getAudioFromCache(url);

export const clearAudioCache = () => 
  audioCacheManager.clearAudioCache();

export const getAudioCacheSize = () => 
  audioCacheManager.getAudioCacheSize();

export const evictOldAudioFiles = (targetReduction?: number) => 
  audioCacheManager.evictOldAudioFiles(targetReduction);

export const isAudioCached = (url: string) => 
  audioCacheManager.isAudioCached(url);

export const prefetchAudioFiles = (urls: string[]) => 
  audioCacheManager.prefetchAudioFiles(urls);

export const getCacheInfo = () => 
  audioCacheManager.getCacheInfo();

export const getCacheStats = () => 
  audioCacheManager.getCacheStats();

// Export the manager instance
export default audioCacheManager;
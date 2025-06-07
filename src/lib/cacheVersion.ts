/**
 * Cache Version Management
 * Handles cache versioning and cleanup of old cache versions
 */

interface CacheVersionInfo {
  version: string;
  timestamp: number;
  description: string;
}

class CacheVersionManager {
  private readonly VERSION_STORAGE_KEY = 'terase_cache_version';
  
  // Current cache version - update this when cache structure changes
  public readonly CACHE_VERSION = 'v1.8.0-phase3';
  
  // Cache name patterns that should be versioned
  private readonly VERSIONED_CACHE_PATTERNS = [
    'critical-',
    'api-cache-',
    'diary-audio-',
    'static-assets-',
  ];

  /**
   * Get current cache version
   */
  getCurrentVersion(): string {
    return this.CACHE_VERSION;
  }

  /**
   * Get version information from storage
   */
  async getVersionInfo(): Promise<CacheVersionInfo | null> {
    try {
      const stored = localStorage.getItem(this.VERSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get version info:', error);
      return null;
    }
  }

  /**
   * Update cache version
   */
  async updateCacheVersion(description?: string): Promise<string> {
    try {
      const newVersion = this.generateNewVersion();
      const versionInfo: CacheVersionInfo = {
        version: newVersion,
        timestamp: Date.now(),
        description: description || 'Cache version updated',
      };

      localStorage.setItem(this.VERSION_STORAGE_KEY, JSON.stringify(versionInfo));
      
      // Clean up old caches after version update
      await this.cleanupOldCaches();
      
      console.log(`Cache version updated to: ${newVersion}`);
      return newVersion;
    } catch (error) {
      console.error('Failed to update cache version:', error);
      throw error;
    }
  }

  /**
   * Clean up old cache versions
   */
  async cleanupOldCaches(): Promise<number> {
    try {
      const cacheNames = await caches.keys();
      const currentVersion = this.CACHE_VERSION;
      let deletedCount = 0;

      // Find caches with old versions
      const oldCaches = cacheNames.filter(cacheName => {
        return this.VERSIONED_CACHE_PATTERNS.some(pattern => {
          return cacheName.includes(pattern) && !cacheName.includes(currentVersion);
        });
      });

      // Delete old caches
      for (const cacheName of oldCaches) {
        try {
          await caches.delete(cacheName);
          deletedCount++;
          console.log(`Deleted old cache: ${cacheName}`);
        } catch (error) {
          console.error(`Failed to delete cache ${cacheName}:`, error);
        }
      }

      console.log(`Cleaned up ${deletedCount} old cache versions`);
      return deletedCount;
    } catch (error) {
      console.error('Cache cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Check if cache version has changed
   */
  async hasVersionChanged(): Promise<boolean> {
    try {
      const versionInfo = await this.getVersionInfo();
      return !versionInfo || versionInfo.version !== this.CACHE_VERSION;
    } catch (error) {
      console.error('Failed to check version change:', error);
      return false;
    }
  }

  /**
   * Get versioned cache name
   */
  getVersionedCacheName(baseName: string): string {
    return `${baseName}-${this.CACHE_VERSION}`;
  }

  /**
   * Initialize cache versioning
   */
  async initializeVersioning(): Promise<void> {
    try {
      const hasChanged = await this.hasVersionChanged();
      
      if (hasChanged) {
        console.log('Cache version changed, updating...');
        await this.updateCacheVersion('Cache structure updated');
      } else {
        console.log(`Cache version up to date: ${this.CACHE_VERSION}`);
      }
    } catch (error) {
      console.error('Failed to initialize cache versioning:', error);
    }
  }

  /**
   * Get all cache versions currently in use
   */
  async getAllCacheVersions(): Promise<{
    current: string;
    active: string[];
    orphaned: string[];
  }> {
    try {
      const cacheNames = await caches.keys();
      const current = this.CACHE_VERSION;
      const active: string[] = [];
      const orphaned: string[] = [];

      for (const cacheName of cacheNames) {
        const isVersioned = this.VERSIONED_CACHE_PATTERNS.some(pattern => 
          cacheName.includes(pattern)
        );

        if (isVersioned) {
          if (cacheName.includes(current)) {
            active.push(cacheName);
          } else {
            orphaned.push(cacheName);
          }
        }
      }

      return { current, active, orphaned };
    } catch (error) {
      console.error('Failed to get cache versions:', error);
      return { current: this.CACHE_VERSION, active: [], orphaned: [] };
    }
  }

  /**
   * Migrate cache data to new version
   */
  async migrateCacheData(oldCacheName: string, newCacheName: string): Promise<boolean> {
    try {
      const oldCache = await caches.open(oldCacheName);
      const newCache = await caches.open(newCacheName);
      
      const requests = await oldCache.keys();
      let migratedCount = 0;

      for (const request of requests) {
        try {
          const response = await oldCache.match(request);
          if (response) {
            await newCache.put(request, response.clone());
            migratedCount++;
          }
        } catch (error) {
          console.warn(`Failed to migrate cache entry: ${request.url}`, error);
        }
      }

      console.log(`Migrated ${migratedCount} cache entries from ${oldCacheName} to ${newCacheName}`);
      
      // Delete old cache after successful migration
      await caches.delete(oldCacheName);
      
      return true;
    } catch (error) {
      console.error(`Cache migration failed: ${oldCacheName} -> ${newCacheName}`, error);
      return false;
    }
  }

  /**
   * Get cache version statistics
   */
  async getVersionStats(): Promise<{
    currentVersion: string;
    totalCaches: number;
    versionedCaches: number;
    orphanedCaches: number;
    totalSize: number;
    lastUpdate?: Date;
  }> {
    try {
      const cacheNames = await caches.keys();
      const versionInfo = await this.getVersionInfo();
      const versions = await this.getAllCacheVersions();
      
      let totalSize = 0;
      
      // Estimate total cache size
      for (const cacheName of cacheNames) {
        try {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          
          for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
              const contentLength = response.headers.get('content-length');
              if (contentLength) {
                totalSize += parseInt(contentLength);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to calculate size for cache: ${cacheName}`);
        }
      }

      return {
        currentVersion: this.CACHE_VERSION,
        totalCaches: cacheNames.length,
        versionedCaches: versions.active.length,
        orphanedCaches: versions.orphaned.length,
        totalSize,
        lastUpdate: versionInfo ? new Date(versionInfo.timestamp) : undefined,
      };
    } catch (error) {
      console.error('Failed to get version stats:', error);
      return {
        currentVersion: this.CACHE_VERSION,
        totalCaches: 0,
        versionedCaches: 0,
        orphanedCaches: 0,
        totalSize: 0,
      };
    }
  }

  /**
   * Force cache version update
   */
  async forceCacheUpdate(reason?: string): Promise<void> {
    try {
      // Clear all versioned caches
      await this.cleanupOldCaches();
      
      // Update version with timestamp to force refresh
      const newVersion = `${this.CACHE_VERSION}-${Date.now()}`;
      const versionInfo: CacheVersionInfo = {
        version: newVersion,
        timestamp: Date.now(),
        description: reason || 'Forced cache update',
      };

      localStorage.setItem(this.VERSION_STORAGE_KEY, JSON.stringify(versionInfo));
      
      console.log(`Forced cache update: ${newVersion}`);
    } catch (error) {
      console.error('Failed to force cache update:', error);
      throw error;
    }
  }

  /**
   * Generate new version string
   */
  private generateNewVersion(): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
    return `${this.CACHE_VERSION}-${timestamp}`;
  }
}

// Create singleton instance
const cacheVersionManager = new CacheVersionManager();

// Export constants and functions
export const CACHE_VERSION = cacheVersionManager.CACHE_VERSION;
export const getCurrentVersion = () => cacheVersionManager.getCurrentVersion();
export const getVersionInfo = () => cacheVersionManager.getVersionInfo();
export const updateCacheVersion = (description?: string) => 
  cacheVersionManager.updateCacheVersion(description);
export const cleanupOldCaches = () => cacheVersionManager.cleanupOldCaches();
export const hasVersionChanged = () => cacheVersionManager.hasVersionChanged();
export const getVersionedCacheName = (baseName: string) => 
  cacheVersionManager.getVersionedCacheName(baseName);
export const initializeVersioning = () => cacheVersionManager.initializeVersioning();
export const getAllCacheVersions = () => cacheVersionManager.getAllCacheVersions();
export const migrateCacheData = (oldCacheName: string, newCacheName: string) =>
  cacheVersionManager.migrateCacheData(oldCacheName, newCacheName);
export const getVersionStats = () => cacheVersionManager.getVersionStats();
export const forceCacheUpdate = (reason?: string) => 
  cacheVersionManager.forceCacheUpdate(reason);

// Export the manager instance
export default cacheVersionManager;
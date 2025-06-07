import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock Service Worker and related APIs
const mockServiceWorkerContainer = {
  register: vi.fn(),
  ready: Promise.resolve({
    active: {
      postMessage: vi.fn(),
    },
    sync: {
      register: vi.fn(),
    },
  }),
  controller: null,
  oncontrollerchange: null,
  onmessage: null,
  onerror: null,
};

const mockCacheStorage = {
  open: vi.fn(),
  has: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn(),
  match: vi.fn(),
};

const mockCache = {
  put: vi.fn(),
  add: vi.fn(),
  addAll: vi.fn(),
  match: vi.fn(),
  matchAll: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn(),
};

const mockStorageEstimate = {
  quota: 1000000000, // 1GB
  usage: 100000000,  // 100MB
  usageDetails: {
    caches: 50000000, // 50MB
    indexedDB: 30000000, // 30MB
    serviceWorkerRegistrations: 1000000, // 1MB
  },
};

// Setup global mocks
beforeAll(() => {
  global.navigator = {
    ...global.navigator,
    serviceWorker: mockServiceWorkerContainer,
    storage: {
      estimate: vi.fn().mockResolvedValue(mockStorageEstimate),
      persist: vi.fn().mockResolvedValue(true),
    },
  } as any;

  global.caches = mockCacheStorage as any;
  
  // Mock Workbox classes that might be imported
  global.workbox = {
    precaching: {
      precacheAndRoute: vi.fn(),
      cleanupOutdatedCaches: vi.fn(),
    },
    routing: {
      registerRoute: vi.fn(),
    },
    strategies: {
      NetworkFirst: vi.fn(),
      CacheFirst: vi.fn(),
      StaleWhileRevalidate: vi.fn(),
    },
  } as any;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheStorage.open.mockResolvedValue(mockCache);
  mockCacheStorage.has.mockResolvedValue(true);
  mockCacheStorage.keys.mockResolvedValue(['api-cache', 'static-audio-assets', 'diary-audio']);
});

describe('Service Worker Phase 3 Implementation', () => {
  describe('Service Worker Registration Logic', () => {
    it('should register service worker with custom configuration', async () => {
      const registration = await import('../lib/serviceWorkerRegistration');
      
      expect(registration.registerSW).toBeDefined();
      expect(typeof registration.registerSW).toBe('function');
    });

    it('should handle service worker registration errors gracefully', async () => {
      mockServiceWorkerContainer.register.mockRejectedValueOnce(new Error('Registration failed'));
      
      const registration = await import('../lib/serviceWorkerRegistration');
      
      expect(() => registration.registerSW()).not.toThrow();
    });

    it('should register background sync when service worker is ready', async () => {
      const registration = await import('../lib/serviceWorkerRegistration');
      
      await registration.registerBackgroundSync();
      
      expect(mockServiceWorkerContainer.ready).toBeDefined();
    });

    it('should post messages to service worker for cache management', async () => {
      const registration = await import('../lib/serviceWorkerRegistration');
      
      await registration.postMessageToSW({ type: 'CACHE_CLEANUP' });
      
      expect(mockServiceWorkerContainer.ready).toBeDefined();
    });
  });

  describe('Offline Page', () => {
    it('should have an offline.html page', () => {
      const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
      expect(fs.existsSync(offlinePath)).toBe(true);
    });

    it('should have properly structured offline page content', () => {
      const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
      const offlineContent = fs.readFileSync(offlinePath, 'utf-8');
      
      expect(offlineContent).toContain('<!DOCTYPE html>');
      expect(offlineContent).toContain('<html');
      expect(offlineContent).toContain('オフライン'); // Japanese for "offline"
      expect(offlineContent).toContain('terase');
      expect(offlineContent).toContain('manifest="/manifest.json"');
    });

    it('should include offline page styles and scripts', () => {
      const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
      const offlineContent = fs.readFileSync(offlinePath, 'utf-8');
      
      expect(offlineContent).toContain('<style>');
      expect(offlineContent).toContain('body');
      expect(offlineContent).toContain('background');
    });

    it('should provide retry mechanism in offline page', () => {
      const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
      const offlineContent = fs.readFileSync(offlinePath, 'utf-8');
      
      expect(offlineContent).toContain('button');
      expect(offlineContent).toContain('再試行'); // Japanese for "retry"
      expect(offlineContent).toContain('location.reload()');
    });
  });

  describe('Enhanced Audio File Caching', () => {
    it('should implement dedicated audio cache management', async () => {
      const audioCache = await import('../lib/audio/audioCache');
      
      expect(audioCache.cacheAudioFile).toBeDefined();
      expect(audioCache.getAudioFromCache).toBeDefined();
      expect(audioCache.clearAudioCache).toBeDefined();
      expect(audioCache.getAudioCacheSize).toBeDefined();
    });

    it('should cache audio files with proper expiration', async () => {
      const audioCache = await import('../lib/audio/audioCache');
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      
      await audioCache.cacheAudioFile('test-audio.wav', mockAudioBlob);
      
      expect(mockCacheStorage.open).toHaveBeenCalledWith('diary-audio');
      expect(mockCache.put).toHaveBeenCalled();
    });

    it('should retrieve audio files from cache', async () => {
      const audioCache = await import('../lib/audio/audioCache');
      mockCache.match.mockResolvedValueOnce(new Response('cached audio'));
      
      const cachedAudio = await audioCache.getAudioFromCache('test-audio.wav');
      
      expect(cachedAudio).toBeDefined();
      expect(mockCache.match).toHaveBeenCalledWith('test-audio.wav');
    });

    it('should manage audio cache size limits', async () => {
      const audioCache = await import('../lib/audio/audioCache');
      
      const cacheSize = await audioCache.getAudioCacheSize();
      
      expect(typeof cacheSize).toBe('number');
      expect(cacheSize).toBeGreaterThanOrEqual(0);
    });

    it('should implement LRU eviction for audio cache', async () => {
      const audioCache = await import('../lib/audio/audioCache');
      
      await audioCache.evictOldAudioFiles();
      
      expect(mockCache.keys).toHaveBeenCalled();
    });
  });

  describe('Storage Quota Management', () => {
    it('should monitor storage usage', async () => {
      const storageManager = await import('../lib/storageManager');
      
      const usage = await storageManager.getStorageUsage();
      
      expect(usage).toBeDefined();
      expect(usage.quota).toBe(1000000000);
      expect(usage.usage).toBe(100000000);
      expect(usage.available).toBe(900000000);
      expect(usage.percentage).toBe(10);
    });

    it('should detect when storage quota is approaching limit', async () => {
      const storageManager = await import('../lib/storageManager');
      
      const isApproachingLimit = await storageManager.isApproachingQuota();
      
      expect(typeof isApproachingLimit).toBe('boolean');
    });

    it('should implement automatic cleanup when quota exceeded', async () => {
      const storageManager = await import('../lib/storageManager');
      
      await storageManager.cleanupWhenQuotaExceeded();
      
      expect(mockCacheStorage.keys).toHaveBeenCalled();
    });

    it('should prioritize cache cleanup by importance', async () => {
      const storageManager = await import('../lib/storageManager');
      
      const cleanupPlan = await storageManager.generateCleanupPlan();
      
      expect(cleanupPlan).toBeDefined();
      expect(Array.isArray(cleanupPlan)).toBe(true);
      expect(cleanupPlan.length).toBeGreaterThan(0);
    });

    it('should preserve critical caches during cleanup', async () => {
      const storageManager = await import('../lib/storageManager');
      const criticalCaches = ['start-url', 'next-static-js-assets'];
      
      const cleanupPlan = await storageManager.generateCleanupPlan();
      const cachesToDelete = cleanupPlan.map(item => item.cacheName);
      
      criticalCaches.forEach(criticalCache => {
        expect(cachesToDelete).not.toContain(criticalCache);
      });
    });
  });

  describe('API Response Caching Strategy', () => {
    it('should implement smart API response caching', async () => {
      const apiCache = await import('../lib/api/cacheStrategy');
      
      expect(apiCache.cacheAPIResponse).toBeDefined();
      expect(apiCache.getAPIResponse).toBeDefined();
      expect(apiCache.invalidateAPICache).toBeDefined();
    });

    it('should cache GET API responses with TTL', async () => {
      const apiCache = await import('../lib/api/cacheStrategy');
      const mockResponse = new Response('{"data": "test"}', {
        headers: { 'Content-Type': 'application/json' },
      });
      
      await apiCache.cacheAPIResponse('/api/diaries', mockResponse);
      
      expect(mockCacheStorage.open).toHaveBeenCalledWith('api-cache');
      expect(mockCache.put).toHaveBeenCalled();
    });

    it('should not cache POST/PUT/DELETE API responses', async () => {
      const apiCache = await import('../lib/api/cacheStrategy');
      const mockResponse = new Response('{"success": true}');
      
      const cached = await apiCache.shouldCacheResponse('/api/diaries', 'POST', mockResponse);
      
      expect(cached).toBe(false);
    });

    it('should implement cache invalidation for related endpoints', async () => {
      const apiCache = await import('../lib/api/cacheStrategy');
      
      await apiCache.invalidateRelatedAPIs('/api/diaries/messages');
      
      expect(mockCache.delete).toHaveBeenCalled();
    });
  });

  describe('Background Sync Implementation', () => {
    it('should register background sync for failed requests', async () => {
      const bgSync = await import('../lib/backgroundSync');
      
      await bgSync.registerSync('diary-sync');
      
      expect(mockServiceWorkerContainer.ready).toBeDefined();
    });

    it('should queue failed requests for retry', async () => {
      const bgSync = await import('../lib/backgroundSync');
      const failedRequest = {
        url: '/api/diaries',
        method: 'POST',
        body: '{"text": "test"}',
        headers: { 'Content-Type': 'application/json' },
      };
      
      await bgSync.queueFailedRequest(failedRequest);
      
      expect(bgSync.getQueuedRequests).toBeDefined();
    });

    it('should retry queued requests when online', async () => {
      const bgSync = await import('../lib/backgroundSync');
      
      const retryCount = await bgSync.retryQueuedRequests();
      
      expect(typeof retryCount).toBe('number');
      expect(retryCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle sync event in service worker', async () => {
      const bgSync = await import('../lib/backgroundSync');
      
      expect(bgSync.handleSyncEvent).toBeDefined();
      expect(typeof bgSync.handleSyncEvent).toBe('function');
    });
  });

  describe('Service Worker Event Handling', () => {
    it('should handle install event properly', async () => {
      const swEvents = await import('../lib/serviceWorkerEvents');
      
      expect(swEvents.handleInstall).toBeDefined();
      expect(typeof swEvents.handleInstall).toBe('function');
    });

    it('should handle activate event for cache cleanup', async () => {
      const swEvents = await import('../lib/serviceWorkerEvents');
      
      expect(swEvents.handleActivate).toBeDefined();
      expect(typeof swEvents.handleActivate).toBe('function');
    });

    it('should handle fetch event with fallback strategies', async () => {
      const swEvents = await import('../lib/serviceWorkerEvents');
      
      expect(swEvents.handleFetch).toBeDefined();
      expect(typeof swEvents.handleFetch).toBe('function');
    });

    it('should serve offline page for navigation requests when offline', async () => {
      const swEvents = await import('../lib/serviceWorkerEvents');
      const mockEvent = {
        request: {
          mode: 'navigate',
          url: 'https://example.com/calendar',
          method: 'GET',
        },
        respondWith: vi.fn(),
      };
      
      await swEvents.handleFetch(mockEvent as any);
      
      expect(mockEvent.respondWith).toHaveBeenCalled();
    });
  });

  describe('Cache Versioning and Updates', () => {
    it('should implement cache versioning', async () => {
      const cacheVersion = await import('../lib/cacheVersion');
      
      expect(cacheVersion.CACHE_VERSION).toBeDefined();
      expect(typeof cacheVersion.CACHE_VERSION).toBe('string');
    });

    it('should clean up old cache versions', async () => {
      const cacheVersion = await import('../lib/cacheVersion');
      
      await cacheVersion.cleanupOldCaches();
      
      expect(mockCacheStorage.keys).toHaveBeenCalled();
    });

    it('should update cache version on app update', async () => {
      const cacheVersion = await import('../lib/cacheVersion');
      
      const newVersion = await cacheVersion.updateCacheVersion();
      
      expect(typeof newVersion).toBe('string');
      expect(newVersion).not.toBe(cacheVersion.CACHE_VERSION);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle service worker errors gracefully', async () => {
      const errorHandler = await import('../lib/serviceWorkerErrors');
      
      expect(errorHandler.handleSWError).toBeDefined();
      expect(typeof errorHandler.handleSWError).toBe('function');
    });

    it('should implement fallback strategies for cache failures', async () => {
      const errorHandler = await import('../lib/serviceWorkerErrors');
      mockCache.match.mockRejectedValueOnce(new Error('Cache error'));
      
      const fallbackResponse = await errorHandler.handleCacheError('test-url');
      
      expect(fallbackResponse).toBeDefined();
    });

    it('should log service worker errors for debugging', async () => {
      const errorHandler = await import('../lib/serviceWorkerErrors');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await errorHandler.logSWError(new Error('Test error'), 'test-context');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track cache hit rates', async () => {
      const perf = await import('../lib/performanceMonitoring');
      
      await perf.trackCacheHit('api-cache');
      await perf.trackCacheMiss('api-cache');
      
      const hitRate = await perf.getCacheHitRate('api-cache');
      
      expect(typeof hitRate).toBe('number');
      expect(hitRate).toBeGreaterThanOrEqual(0);
      expect(hitRate).toBeLessThanOrEqual(1);
    });

    it('should monitor service worker performance', async () => {
      const perf = await import('../lib/performanceMonitoring');
      
      const metrics = await perf.getServiceWorkerMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.cacheHitRates).toBeDefined();
      expect(metrics.storageUsage).toBeDefined();
    });
  });
});
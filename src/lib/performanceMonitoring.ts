/**
 * Performance Monitoring for Service Worker
 * Tracks cache hit rates, response times, and overall SW performance
 */

interface CacheHitData {
  cacheName: string;
  hits: number;
  misses: number;
  totalRequests: number;
  lastAccessed: number;
}

interface PerformanceMetric {
  metric: string;
  value: number;
  timestamp: number;
  category: 'cache' | 'network' | 'storage' | 'sync';
}

interface ServiceWorkerMetrics {
  cacheHitRates: Record<string, number>;
  storageUsage: {
    total: number;
    breakdown: Record<string, number>;
  };
  averageResponseTimes: Record<string, number>;
  syncPerformance: {
    successRate: number;
    averageRetryCount: number;
    lastSyncTime?: number;
  };
  errorRates: Record<string, number>;
  uptime: number;
}

class PerformanceMonitor {
  private readonly METRICS_STORAGE_KEY = 'terase_sw_metrics';
  private readonly CACHE_HITS_KEY = 'terase_cache_hits';
  private readonly MAX_METRICS = 1000;
  private readonly startTime = Date.now();

  /**
   * Track cache hit
   */
  async trackCacheHit(cacheName: string): Promise<void> {
    try {
      const hitData = await this.getCacheHitData();
      
      if (!hitData[cacheName]) {
        hitData[cacheName] = {
          cacheName,
          hits: 0,
          misses: 0,
          totalRequests: 0,
          lastAccessed: Date.now(),
        };
      }

      hitData[cacheName].hits++;
      hitData[cacheName].totalRequests++;
      hitData[cacheName].lastAccessed = Date.now();

      await this.saveCacheHitData(hitData);
      
      // Record performance metric
      await this.recordMetric('cache_hit', 1, 'cache');
    } catch (error) {
      console.error('Failed to track cache hit:', error);
    }
  }

  /**
   * Track cache miss
   */
  async trackCacheMiss(cacheName: string): Promise<void> {
    try {
      const hitData = await this.getCacheHitData();
      
      if (!hitData[cacheName]) {
        hitData[cacheName] = {
          cacheName,
          hits: 0,
          misses: 0,
          totalRequests: 0,
          lastAccessed: Date.now(),
        };
      }

      hitData[cacheName].misses++;
      hitData[cacheName].totalRequests++;
      hitData[cacheName].lastAccessed = Date.now();

      await this.saveCacheHitData(hitData);
      
      // Record performance metric
      await this.recordMetric('cache_miss', 1, 'cache');
    } catch (error) {
      console.error('Failed to track cache miss:', error);
    }
  }

  /**
   * Get cache hit rate for specific cache
   */
  async getCacheHitRate(cacheName: string): Promise<number> {
    try {
      const hitData = await this.getCacheHitData();
      const data = hitData[cacheName];
      
      if (!data || data.totalRequests === 0) {
        return 0;
      }

      return data.hits / data.totalRequests;
    } catch (error) {
      console.error('Failed to get cache hit rate:', error);
      return 0;
    }
  }

  /**
   * Track response time
   */
  async trackResponseTime(url: string, responseTime: number, source: 'cache' | 'network'): Promise<void> {
    try {
      await this.recordMetric(`response_time_${source}`, responseTime, source === 'cache' ? 'cache' : 'network');
      await this.recordMetric(`response_time_${this.categorizeURL(url)}`, responseTime, 'network');
    } catch (error) {
      console.error('Failed to track response time:', error);
    }
  }

  /**
   * Track sync performance
   */
  async trackSyncSuccess(syncTag: string, retryCount: number = 0): Promise<void> {
    try {
      await this.recordMetric('sync_success', 1, 'sync');
      await this.recordMetric('sync_retry_count', retryCount, 'sync');
      await this.recordMetric(`sync_${syncTag}_success`, 1, 'sync');
    } catch (error) {
      console.error('Failed to track sync success:', error);
    }
  }

  /**
   * Track sync failure
   */
  async trackSyncFailure(syncTag: string, retryCount: number = 0): Promise<void> {
    try {
      await this.recordMetric('sync_failure', 1, 'sync');
      await this.recordMetric('sync_retry_count', retryCount, 'sync');
      await this.recordMetric(`sync_${syncTag}_failure`, 1, 'sync');
    } catch (error) {
      console.error('Failed to track sync failure:', error);
    }
  }

  /**
   * Track storage operation
   */
  async trackStorageOperation(operation: 'read' | 'write' | 'delete', duration: number): Promise<void> {
    try {
      await this.recordMetric(`storage_${operation}`, 1, 'storage');
      await this.recordMetric(`storage_${operation}_duration`, duration, 'storage');
    } catch (error) {
      console.error('Failed to track storage operation:', error);
    }
  }

  /**
   * Get comprehensive service worker metrics
   */
  async getServiceWorkerMetrics(): Promise<ServiceWorkerMetrics> {
    try {
      const [cacheHitData, metrics, storageUsage] = await Promise.all([
        this.getCacheHitData(),
        this.getMetrics(),
        this.getStorageUsage(),
      ]);

      // Calculate cache hit rates
      const cacheHitRates: Record<string, number> = {};
      Object.values(cacheHitData).forEach(data => {
        cacheHitRates[data.cacheName] = data.totalRequests > 0 
          ? data.hits / data.totalRequests 
          : 0;
      });

      // Calculate average response times
      const averageResponseTimes = this.calculateAverageResponseTimes(metrics);

      // Calculate sync performance
      const syncPerformance = this.calculateSyncPerformance(metrics);

      // Calculate error rates
      const errorRates = this.calculateErrorRates(metrics);

      return {
        cacheHitRates,
        storageUsage,
        averageResponseTimes,
        syncPerformance,
        errorRates,
        uptime: Date.now() - this.startTime,
      };
    } catch (error) {
      console.error('Failed to get service worker metrics:', error);
      return {
        cacheHitRates: {},
        storageUsage: { total: 0, breakdown: {} },
        averageResponseTimes: {},
        syncPerformance: { successRate: 0, averageRetryCount: 0 },
        errorRates: {},
        uptime: Date.now() - this.startTime,
      };
    }
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(): Promise<{
    overallCacheHitRate: number;
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    syncSuccessRate: number;
    storageUsagePercentage: number;
  }> {
    try {
      const metrics = await this.getServiceWorkerMetrics();
      
      // Calculate overall cache hit rate
      const hitRates = Object.values(metrics.cacheHitRates);
      const overallCacheHitRate = hitRates.length > 0 
        ? hitRates.reduce((sum, rate) => sum + rate, 0) / hitRates.length
        : 0;

      // Calculate average response time
      const responseTimes = Object.values(metrics.averageResponseTimes);
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      // Calculate total requests
      const cacheHitData = await this.getCacheHitData();
      const totalRequests = Object.values(cacheHitData)
        .reduce((sum, data) => sum + data.totalRequests, 0);

      // Calculate error rate
      const errorRates = Object.values(metrics.errorRates);
      const errorRate = errorRates.length > 0
        ? errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length
        : 0;

      // Get storage usage percentage
      const storageUsagePercentage = await this.getStorageUsagePercentage();

      return {
        overallCacheHitRate,
        averageResponseTime,
        totalRequests,
        errorRate,
        syncSuccessRate: metrics.syncPerformance.successRate,
        storageUsagePercentage,
      };
    } catch (error) {
      console.error('Failed to get performance summary:', error);
      return {
        overallCacheHitRate: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        syncSuccessRate: 0,
        storageUsagePercentage: 0,
      };
    }
  }

  /**
   * Clear all performance data
   */
  async clearPerformanceData(): Promise<void> {
    try {
      localStorage.removeItem(this.METRICS_STORAGE_KEY);
      localStorage.removeItem(this.CACHE_HITS_KEY);
      console.log('Performance data cleared');
    } catch (error) {
      console.error('Failed to clear performance data:', error);
    }
  }

  /**
   * Export performance data
   */
  async exportPerformanceData(): Promise<{
    metrics: ServiceWorkerMetrics;
    summary: any;
    rawData: {
      cacheHits: Record<string, CacheHitData>;
      metrics: PerformanceMetric[];
    };
    exportedAt: string;
  }> {
    try {
      const [metrics, summary, cacheHitData, rawMetrics] = await Promise.all([
        this.getServiceWorkerMetrics(),
        this.getPerformanceSummary(),
        this.getCacheHitData(),
        this.getMetrics(),
      ]);

      return {
        metrics,
        summary,
        rawData: {
          cacheHits: cacheHitData,
          metrics: rawMetrics,
        },
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to export performance data:', error);
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private async recordMetric(metric: string, value: number, category: PerformanceMetric['category']): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      metrics.push({
        metric,
        value,
        timestamp: Date.now(),
        category,
      });

      // Keep only recent metrics
      if (metrics.length > this.MAX_METRICS) {
        metrics.splice(0, metrics.length - this.MAX_METRICS);
      }

      localStorage.setItem(this.METRICS_STORAGE_KEY, JSON.stringify(metrics));
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  /**
   * Get all performance metrics
   */
  private async getMetrics(): Promise<PerformanceMetric[]> {
    try {
      const stored = localStorage.getItem(this.METRICS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return [];
    }
  }

  /**
   * Get cache hit data
   */
  private async getCacheHitData(): Promise<Record<string, CacheHitData>> {
    try {
      const stored = localStorage.getItem(this.CACHE_HITS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get cache hit data:', error);
      return {};
    }
  }

  /**
   * Save cache hit data
   */
  private async saveCacheHitData(data: Record<string, CacheHitData>): Promise<void> {
    try {
      localStorage.setItem(this.CACHE_HITS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save cache hit data:', error);
    }
  }

  /**
   * Calculate average response times by category
   */
  private calculateAverageResponseTimes(metrics: PerformanceMetric[]): Record<string, number> {
    const responseTimeMetrics = metrics.filter(m => m.metric.includes('response_time'));
    const averages: Record<string, { total: number; count: number }> = {};

    responseTimeMetrics.forEach(metric => {
      const category = metric.metric.replace('response_time_', '');
      if (!averages[category]) {
        averages[category] = { total: 0, count: 0 };
      }
      averages[category].total += metric.value;
      averages[category].count++;
    });

    const result: Record<string, number> = {};
    Object.entries(averages).forEach(([category, data]) => {
      result[category] = data.count > 0 ? data.total / data.count : 0;
    });

    return result;
  }

  /**
   * Calculate sync performance
   */
  private calculateSyncPerformance(metrics: PerformanceMetric[]): ServiceWorkerMetrics['syncPerformance'] {
    const syncMetrics = metrics.filter(m => m.category === 'sync');
    const successes = syncMetrics.filter(m => m.metric === 'sync_success').length;
    const failures = syncMetrics.filter(m => m.metric === 'sync_failure').length;
    const retryMetrics = syncMetrics.filter(m => m.metric === 'sync_retry_count');
    
    const totalSyncs = successes + failures;
    const successRate = totalSyncs > 0 ? successes / totalSyncs : 0;
    
    const averageRetryCount = retryMetrics.length > 0
      ? retryMetrics.reduce((sum, m) => sum + m.value, 0) / retryMetrics.length
      : 0;

    const lastSyncMetric = syncMetrics
      .filter(m => m.metric.includes('sync_'))
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    return {
      successRate,
      averageRetryCount,
      lastSyncTime: lastSyncMetric?.timestamp,
    };
  }

  /**
   * Calculate error rates
   */
  private calculateErrorRates(metrics: PerformanceMetric[]): Record<string, number> {
    // This would be implemented based on error tracking
    // For now, return empty object
    return {};
  }

  /**
   * Get storage usage
   */
  private async getStorageUsage(): Promise<ServiceWorkerMetrics['storageUsage']> {
    try {
      const { getStorageBreakdown, getStorageUsage } = await import('./storageManager');
      const [breakdown, usage] = await Promise.all([
        getStorageBreakdown(),
        getStorageUsage(),
      ]);

      return {
        total: usage.usage,
        breakdown,
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { total: 0, breakdown: {} };
    }
  }

  /**
   * Get storage usage percentage
   */
  private async getStorageUsagePercentage(): Promise<number> {
    try {
      const { getStorageUsage } = await import('./storageManager');
      const usage = await getStorageUsage();
      return usage.percentage;
    } catch (error) {
      console.error('Failed to get storage usage percentage:', error);
      return 0;
    }
  }

  /**
   * Categorize URL for metrics
   */
  private categorizeURL(url: string): string {
    if (url.includes('/api/')) return 'api';
    if (url.includes('.html')) return 'html';
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'css';
    if (url.includes('audio') || url.includes('.wav') || url.includes('.mp3')) return 'audio';
    if (url.includes('image') || url.includes('.png') || url.includes('.jpg')) return 'image';
    return 'other';
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export functions for compatibility with tests
export const trackCacheHit = (cacheName: string) => performanceMonitor.trackCacheHit(cacheName);
export const trackCacheMiss = (cacheName: string) => performanceMonitor.trackCacheMiss(cacheName);
export const getCacheHitRate = (cacheName: string) => performanceMonitor.getCacheHitRate(cacheName);
export const trackResponseTime = (url: string, responseTime: number, source: 'cache' | 'network') =>
  performanceMonitor.trackResponseTime(url, responseTime, source);
export const trackSyncSuccess = (syncTag: string, retryCount?: number) =>
  performanceMonitor.trackSyncSuccess(syncTag, retryCount);
export const trackSyncFailure = (syncTag: string, retryCount?: number) =>
  performanceMonitor.trackSyncFailure(syncTag, retryCount);
export const trackStorageOperation = (operation: 'read' | 'write' | 'delete', duration: number) =>
  performanceMonitor.trackStorageOperation(operation, duration);
export const getServiceWorkerMetrics = () => performanceMonitor.getServiceWorkerMetrics();
export const getPerformanceSummary = () => performanceMonitor.getPerformanceSummary();
export const clearPerformanceData = () => performanceMonitor.clearPerformanceData();
export const exportPerformanceData = () => performanceMonitor.exportPerformanceData();

// Export the monitor instance
export default performanceMonitor;
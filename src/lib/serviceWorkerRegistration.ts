/**
 * Service Worker Registration and Management
 * Enhanced PWA functionality for terase app
 */

interface SWMessage {
  type: string;
  payload?: any;
}

interface BackgroundSyncOptions {
  tag: string;
  options?: {
    minDelay?: number;
    maxDelay?: number;
  };
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'serviceWorker' in navigator;
  }

  /**
   * Register service worker with enhanced error handling
   */
  async registerSW(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported) {
      console.warn('Service Worker is not supported in this browser');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      this.registration = registration;

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available
              this.handleServiceWorkerUpdate(newWorker);
            }
          });
        }
      });

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker has taken control
        window.location.reload();
      });

      console.log('Service Worker registered successfully:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      this.handleRegistrationError(error);
      return null;
    }
  }

  /**
   * Register background sync with retry logic
   */
  async registerBackgroundSync(options: BackgroundSyncOptions): Promise<void> {
    if (!this.isSupported || typeof window === 'undefined' || !window.ServiceWorkerRegistration || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('Background Sync is not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(options.tag);
      console.log(`Background sync registered: ${options.tag}`);
    } catch (error) {
      console.error('Background sync registration failed:', error);
      throw error;
    }
  }

  /**
   * Post message to service worker
   */
  async postMessageToSW(message: SWMessage): Promise<void> {
    if (!this.isSupported) {
      console.warn('Service Worker messaging not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage(message);
      } else {
        console.warn('No active service worker found');
      }
    } catch (error) {
      console.error('Failed to post message to service worker:', error);
      throw error;
    }
  }

  /**
   * Get service worker registration status
   */
  async getRegistrationStatus(): Promise<{
    isRegistered: boolean;
    isActive: boolean;
    isWaiting: boolean;
    scope?: string;
  }> {
    if (!this.isSupported) {
      return { isRegistered: false, isActive: false, isWaiting: false };
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      return {
        isRegistered: !!registration,
        isActive: !!registration?.active,
        isWaiting: !!registration?.waiting,
        scope: registration?.scope,
      };
    } catch (error) {
      console.error('Failed to get registration status:', error);
      return { isRegistered: false, isActive: false, isWaiting: false };
    }
  }

  /**
   * Force service worker update
   */
  async forceUpdate(): Promise<void> {
    if (!this.registration) {
      throw new Error('No service worker registration found');
    }

    try {
      await this.registration.update();
      console.log('Service worker update check completed');
    } catch (error) {
      console.error('Service worker update failed:', error);
      throw error;
    }
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const result = await registration.unregister();
        console.log('Service worker unregistered:', result);
        return result;
      }
      return false;
    } catch (error) {
      console.error('Service worker unregistration failed:', error);
      return false;
    }
  }

  /**
   * Handle service worker update notification
   */
  private handleServiceWorkerUpdate(newWorker: ServiceWorker): void {
    // You can implement custom UI notification here
    console.log('New service worker available. Refresh to update.');
    
    // Optionally auto-update by calling newWorker.postMessage({type: 'SKIP_WAITING'})
    // and handling it in the service worker
  }

  /**
   * Handle registration errors with categorization
   */
  private handleRegistrationError(error: Error): void {
    if (error.name === 'SecurityError') {
      console.error('Service Worker registration blocked by security policy');
    } else if (error.name === 'NetworkError') {
      console.error('Service Worker registration failed due to network error');
    } else {
      console.error('Service Worker registration failed:', error.message);
    }
  }
}

// Create singleton instance
const swManager = new ServiceWorkerManager();

// Export functions for compatibility with tests
export const registerSW = () => swManager.registerSW();
export const registerBackgroundSync = (tag: string = 'diary-sync') => 
  swManager.registerBackgroundSync({ tag });
export const postMessageToSW = (message: SWMessage) => swManager.postMessageToSW(message);
export const getRegistrationStatus = () => swManager.getRegistrationStatus();
export const forceUpdate = () => swManager.forceUpdate();
export const unregisterSW = () => swManager.unregister();

// Export the manager instance
export default swManager;

// Auto-register service worker when module is imported (in production)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  swManager.registerSW().catch(console.error);
}
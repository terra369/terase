/**
 * Platform-agnostic device detection utilities
 * Enhanced device detection extracted from src/lib/deviceDetection.ts
 */

export interface PlatformInfo {
  platform: 'web' | 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown'
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  browser?: BrowserInfo
  os?: OSInfo
}

export interface BrowserInfo {
  name: string
  version?: string
  engine?: string
}

export interface OSInfo {
  name: string
  version?: string
}

export interface DeviceCapabilities {
  hasTouch: boolean
  hasKeyboard: boolean
  hasMicrophone: boolean
  hasSpeakers: boolean
  hasCamera: boolean
  supportsWebRTC: boolean
  supportsServiceWorkers: boolean
  supportsWebAssembly: boolean
  supportsOfflineStorage: boolean
  maxTouchPoints: number
  screenSize: { width: number; height: number }
  devicePixelRatio: number
}

export class DeviceDetector {
  private static instance: DeviceDetector
  private cachedInfo: PlatformInfo | null = null
  private cachedCapabilities: DeviceCapabilities | null = null

  static getInstance(): DeviceDetector {
    if (!DeviceDetector.instance) {
      DeviceDetector.instance = new DeviceDetector()
    }
    return DeviceDetector.instance
  }

  detectPlatform(): PlatformInfo {
    if (this.cachedInfo) {
      return this.cachedInfo
    }

    if (typeof window === 'undefined') {
      // Server-side or React Native environment
      this.cachedInfo = this.detectServerSidePlatform()
    } else {
      // Browser environment
      this.cachedInfo = this.detectBrowserPlatform()
    }

    return this.cachedInfo
  }

  private detectServerSidePlatform(): PlatformInfo {
    // For server-side rendering or React Native
    // React Native would have different globals available
    if (typeof global !== 'undefined' && global.navigator) {
      // React Native environment
      return this.parseUserAgent(global.navigator.userAgent || '')
    }

    return {
      platform: 'unknown',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    }
  }

  private detectBrowserPlatform(): PlatformInfo {
    const userAgent = navigator.userAgent
    return this.parseUserAgent(userAgent)
  }

  private parseUserAgent(userAgent: string): PlatformInfo {
    const ua = userAgent.toLowerCase()

    // Platform detection
    let platform: PlatformInfo['platform'] = 'unknown'
    
    if (/android/.test(ua)) {
      platform = 'android'
    } else if (/iphone|ipad|ipod/.test(ua)) {
      platform = 'ios'
    } else if (/windows/.test(ua)) {
      platform = 'windows'
    } else if (/macintosh|mac os x/.test(ua)) {
      platform = 'macos'
    } else if (/linux/.test(ua)) {
      platform = 'linux'
    } else if (typeof window !== 'undefined') {
      platform = 'web'
    }

    // Device type detection
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
    const isTablet = /ipad|android(?!.*mobi)|tablet/i.test(ua)
    const isDesktop = !isMobile && !isTablet

    // Browser detection
    const browser = this.detectBrowser(userAgent)

    // OS detection
    const os = this.detectOS(userAgent)

    return {
      platform,
      isMobile,
      isTablet,
      isDesktop,
      browser,
      os,
    }
  }

  private detectBrowser(userAgent: string): BrowserInfo {
    const ua = userAgent.toLowerCase()

    // Safari detection (must come before Chrome)
    if (/safari/.test(ua) && !/chrome/.test(ua)) {
      const version = userAgent.match(/version\/([0-9.]+)/)?.[1]
      return {
        name: 'safari',
        version,
        engine: 'webkit',
      }
    }

    // Chrome detection
    if (/chrome/.test(ua)) {
      const version = userAgent.match(/chrome\/([0-9.]+)/)?.[1]
      return {
        name: 'chrome',
        version,
        engine: 'blink',
      }
    }

    // Firefox detection
    if (/firefox/.test(ua)) {
      const version = userAgent.match(/firefox\/([0-9.]+)/)?.[1]
      return {
        name: 'firefox',
        version,
        engine: 'gecko',
      }
    }

    // Edge detection
    if (/edg/.test(ua)) {
      const version = userAgent.match(/edg\/([0-9.]+)/)?.[1]
      return {
        name: 'edge',
        version,
        engine: 'blink',
      }
    }

    return {
      name: 'unknown',
      engine: 'unknown',
    }
  }

  private detectOS(userAgent: string): OSInfo {
    const ua = userAgent.toLowerCase()

    if (/android/.test(ua)) {
      const version = userAgent.match(/android ([0-9.]+)/)?.[1]
      return { name: 'android', version }
    }

    if (/iphone|ipad|ipod/.test(ua)) {
      const version = userAgent.match(/os ([0-9_]+)/)?.[1]?.replace(/_/g, '.')
      return { name: 'ios', version }
    }

    if (/windows/.test(ua)) {
      if (/windows nt 10/.test(ua)) return { name: 'windows', version: '10' }
      if (/windows nt 6.3/.test(ua)) return { name: 'windows', version: '8.1' }
      if (/windows nt 6.2/.test(ua)) return { name: 'windows', version: '8' }
      if (/windows nt 6.1/.test(ua)) return { name: 'windows', version: '7' }
      return { name: 'windows' }
    }

    if (/mac os x/.test(ua)) {
      const version = userAgent.match(/mac os x ([0-9_.]+)/)?.[1]?.replace(/_/g, '.')
      return { name: 'macos', version }
    }

    if (/linux/.test(ua)) {
      return { name: 'linux' }
    }

    return { name: 'unknown' }
  }

  detectCapabilities(): DeviceCapabilities {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities
    }

    if (typeof window === 'undefined') {
      // Server-side defaults
      this.cachedCapabilities = {
        hasTouch: false,
        hasKeyboard: true,
        hasMicrophone: false,
        hasSpeakers: false,
        hasCamera: false,
        supportsWebRTC: false,
        supportsServiceWorkers: false,
        supportsWebAssembly: false,
        supportsOfflineStorage: false,
        maxTouchPoints: 0,
        screenSize: { width: 1920, height: 1080 },
        devicePixelRatio: 1,
      }
      return this.cachedCapabilities
    }

    // Browser environment
    this.cachedCapabilities = {
      hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hasKeyboard: true, // Assume keyboard available in browser
      hasMicrophone: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasSpeakers: typeof Audio !== 'undefined',
      hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      supportsWebRTC: !!(window.RTCPeerConnection || (window as any).webkitRTCPeerConnection),
      supportsServiceWorkers: 'serviceWorker' in navigator,
      supportsWebAssembly: typeof WebAssembly === 'object',
      supportsOfflineStorage: 'localStorage' in window && 'indexedDB' in window,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      screenSize: {
        width: window.screen.width,
        height: window.screen.height,
      },
      devicePixelRatio: window.devicePixelRatio || 1,
    }

    return this.cachedCapabilities
  }

  // Utility methods
  isIOS(): boolean {
    return this.detectPlatform().platform === 'ios'
  }

  isAndroid(): boolean {
    return this.detectPlatform().platform === 'android'
  }

  isMobile(): boolean {
    return this.detectPlatform().isMobile
  }

  isTablet(): boolean {
    return this.detectPlatform().isTablet
  }

  isDesktop(): boolean {
    return this.detectPlatform().isDesktop
  }

  isSafari(): boolean {
    return this.detectPlatform().browser?.name === 'safari'
  }

  isIOSSafari(): boolean {
    const info = this.detectPlatform()
    return info.platform === 'ios' && info.browser?.name === 'safari'
  }

  isChrome(): boolean {
    return this.detectPlatform().browser?.name === 'chrome'
  }

  isFirefox(): boolean {
    return this.detectPlatform().browser?.name === 'firefox'
  }

  supportsWebRTC(): boolean {
    return this.detectCapabilities().supportsWebRTC
  }

  hasTouch(): boolean {
    return this.detectCapabilities().hasTouch
  }

  hasMicrophone(): boolean {
    return this.detectCapabilities().hasMicrophone
  }

  // Clear cache for testing
  clearCache(): void {
    this.cachedInfo = null
    this.cachedCapabilities = null
  }

  // Get orientation (mobile specific)
  getOrientation(): 'portrait' | 'landscape' | 'unknown' {
    if (typeof window === 'undefined') return 'unknown'
    
    if (window.screen && window.screen.orientation) {
      return window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180
        ? 'portrait'
        : 'landscape'
    }

    // Fallback using window dimensions
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  }

  // Get network information (if available)
  getNetworkInfo(): {
    type?: string
    effectiveType?: string
    downlink?: number
    rtt?: number
  } {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      return {
        type: connection.type,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      }
    }
    return {}
  }
}

// Singleton instance
export const deviceDetector = DeviceDetector.getInstance()

// Utility functions for common use cases
export const getPlatformInfo = (): PlatformInfo => deviceDetector.detectPlatform()
export const getDeviceCapabilities = (): DeviceCapabilities => deviceDetector.detectCapabilities()
export const isIOS = (): boolean => deviceDetector.isIOS()
export const isAndroid = (): boolean => deviceDetector.isAndroid()
export const isMobile = (): boolean => deviceDetector.isMobile()
export const isTablet = (): boolean => deviceDetector.isTablet()
export const isDesktop = (): boolean => deviceDetector.isDesktop()
export const isIOSSafari = (): boolean => deviceDetector.isIOSSafari()
export const supportsWebRTC = (): boolean => deviceDetector.supportsWebRTC()
export const hasTouch = (): boolean => deviceDetector.hasTouch()
export const hasMicrophone = (): boolean => deviceDetector.hasMicrophone()
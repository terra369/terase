/**
 * Device detection utilities for the terase project
 * Centralizes all device-specific detection logic
 */

export interface DeviceInfo {
  isIOS: boolean;
  isIOSSafari: boolean;
  isMobile: boolean;
  supportsMediaRecorder: boolean;
  supportsWebAudio: boolean;
  requiresUserGesture: boolean;
}

export const DeviceDetection = {
  /**
   * Check if device is iOS (iPad, iPhone, iPod)
   */
  isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && 
           !(window as unknown as { MSStream?: unknown }).MSStream;
  },

  /**
   * Check if device is iOS Safari
   */
  isIOSSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    const isIOS = DeviceDetection.isIOS();
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    return isIOS && isSafari;
  },

  /**
   * Check if device is mobile (basic heuristic)
   */
  isMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  /**
   * Check if browser supports MediaRecorder API
   */
  supportsMediaRecorder(): boolean {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported;
  },

  /**
   * Check if browser supports Web Audio API
   */
  supportsWebAudio(): boolean {
    return typeof AudioContext !== 'undefined' || 
           typeof (window as any).webkitAudioContext !== 'undefined';
  },

  /**
   * Check if browser requires user gesture for audio playback
   */
  requiresUserGesture(): boolean {
    // iOS Safari and many mobile browsers require user gesture
    return DeviceDetection.isIOSSafari() || DeviceDetection.isMobile();
  },

  /**
   * Get comprehensive device information
   */
  getDeviceInfo(): DeviceInfo {
    return {
      isIOS: DeviceDetection.isIOS(),
      isIOSSafari: DeviceDetection.isIOSSafari(),
      isMobile: DeviceDetection.isMobile(),
      supportsMediaRecorder: DeviceDetection.supportsMediaRecorder(),
      supportsWebAudio: DeviceDetection.supportsWebAudio(),
      requiresUserGesture: DeviceDetection.requiresUserGesture(),
    };
  },

  /**
   * Get optimal MediaRecorder MIME type for the device
   */
  getOptimalMimeType(): string {
    if (!DeviceDetection.supportsMediaRecorder()) {
      return '';
    }

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav'
    ];

    for (const mimeType of candidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return '';
  },

  /**
   * Check if device needs special audio handling
   */
  needsSpecialAudioHandling(): boolean {
    return DeviceDetection.isIOS() || DeviceDetection.isIOSSafari();
  },

  /**
   * Get browser name and version (simplified)
   */
  getBrowserInfo(): { name: string; version: string } {
    if (typeof navigator === 'undefined') {
      return { name: 'unknown', version: 'unknown' };
    }

    const ua = navigator.userAgent;
    
    if (ua.includes('Chrome')) {
      const match = ua.match(/Chrome\/(\d+)/);
      return { name: 'Chrome', version: match ? match[1] : 'unknown' };
    }
    
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      const match = ua.match(/Version\/(\d+)/);
      return { name: 'Safari', version: match ? match[1] : 'unknown' };
    }
    
    if (ua.includes('Firefox')) {
      const match = ua.match(/Firefox\/(\d+)/);
      return { name: 'Firefox', version: match ? match[1] : 'unknown' };
    }
    
    if (ua.includes('Edge')) {
      const match = ua.match(/Edge\/(\d+)/);
      return { name: 'Edge', version: match ? match[1] : 'unknown' };
    }

    return { name: 'unknown', version: 'unknown' };
  }
} as const;
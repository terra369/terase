/**
 * Device detection - now extends core platform-agnostic device detection
 * This file provides backward compatibility while leveraging the new core module
 */

// Re-export core device detection
export {
  deviceDetector,
  getPlatformInfo,
  getDeviceCapabilities,
  isIOS,
  isAndroid,
  isMobile,
  isTablet,
  isDesktop,
  isIOSSafari,
  supportsWebRTC,
  hasTouch,
  hasMicrophone
} from '../../core/utils/device-detection';

export {
  getOptimalMimeType,
  requiresUserGesture
} from '../../core/audio/device-detection';

// Legacy interface for backward compatibility
export interface DeviceInfo {
  isIOS: boolean;
  isIOSSafari: boolean;
  isMobile: boolean;
  supportsMediaRecorder: boolean;
  supportsWebAudio: boolean;
  requiresUserGesture: boolean;
}

// Legacy DeviceDetection object for backward compatibility
export const DeviceDetection = {
  isIOS: () => isIOS(),
  isIOSSafari: () => isIOSSafari(),
  isMobile: () => isMobile(),
  supportsMediaRecorder: () => {
    return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
  },
  supportsWebAudio: () => {
    return typeof AudioContext !== 'undefined' || 
           typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';
  },
  requiresUserGesture: () => requiresUserGesture(),
  getDeviceInfo: (): DeviceInfo => {
    return {
      isIOS: isIOS(),
      isIOSSafari: isIOSSafari(),
      isMobile: isMobile(),
      supportsMediaRecorder: DeviceDetection.supportsMediaRecorder(),
      supportsWebAudio: DeviceDetection.supportsWebAudio(),
      requiresUserGesture: requiresUserGesture(),
    };
  },
  getOptimalMimeType: () => getOptimalMimeType(),
  needsSpecialAudioHandling: () => isIOS() || isIOSSafari(),
  getBrowserInfo: () => {
    const platformInfo = getPlatformInfo();
    return {
      name: platformInfo.browser?.name || 'unknown',
      version: platformInfo.browser?.version || 'unknown'
    };
  }
} as const;
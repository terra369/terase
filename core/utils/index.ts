/**
 * Core Utilities module barrel exports
 * Platform-agnostic utility functions for Web/React Native reusability
 */

// Error handling utilities
export {
  ErrorHandler,
  handleAsyncError,
  handleSyncError,
  retryWithBackoff,
  PerformanceTracker,
  createErrorBoundaryState,
  handleErrorBoundary,
} from './error-handling'

// Device detection utilities
export {
  DeviceDetector,
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
  hasMicrophone,
} from './device-detection'

// Validation utilities
export {
  emailSchema,
  dateSchema,
  urlSchema,
  phoneSchema,
  createTextSchema,
  createNumberSchema,
  validateFile,
  validateAudioFile,
  validateImageFile,
  isValidDate,
  isDateInRange,
  isDateInFuture,
  isDateInPast,
  validateTextContent,
  safeValidate,
  formatValidationErrors,
  ValidationPatterns,
  isValidJapaneseText,
  isValidUsername,
  isValidPassword,
  isValidTime,
  isValidDuration,
  sanitizeText,
  sanitizeHTML,
  sanitizeFilename,
} from './validation'

// Type exports
export type {
  PlatformInfo,
  BrowserInfo,
  OSInfo,
  DeviceCapabilities,
  FileValidationOptions,
  ErrorBoundaryState,
  PerformanceMetrics,
} from './device-detection'
/**
 * Platform-agnostic device detection for audio
 * Core device capability detection for Web/React Native reusability
 */

import type { AudioCapabilities, AudioFormat } from './types'
import { DEVICE_CONFIGS, MIME_TYPE_MAPPINGS, getFormatFromMimeType } from './config'

export interface DetectedDevice {
  platform: 'web' | 'ios' | 'android' | 'unknown'
  browser?: string
  version?: string
  isMobile: boolean
  isIOSSafari: boolean
  capabilities: AudioCapabilities
}

export class AudioDeviceDetector {
  private static instance: AudioDeviceDetector
  private cachedDevice: DetectedDevice | null = null

  static getInstance(): AudioDeviceDetector {
    if (!AudioDeviceDetector.instance) {
      AudioDeviceDetector.instance = new AudioDeviceDetector()
    }
    return AudioDeviceDetector.instance
  }

  detectDevice(): DetectedDevice {
    if (this.cachedDevice) {
      return this.cachedDevice
    }

    const platform = this.detectPlatform()
    const browser = this.detectBrowser()
    const isMobile = this.detectMobile()
    const isIOSSafari = this.detectIOSSafari()
    const capabilities = this.detectCapabilities(platform, isIOSSafari)

    this.cachedDevice = {
      platform,
      browser: browser.name,
      version: browser.version,
      isMobile,
      isIOSSafari,
      capabilities,
    }

    return this.cachedDevice
  }

  private detectPlatform(): 'web' | 'ios' | 'android' | 'unknown' {
    if (typeof window === 'undefined') {
      // Server-side or React Native environment
      return 'unknown'
    }

    const userAgent = navigator.userAgent.toLowerCase()

    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'ios'
    }

    if (/android/.test(userAgent)) {
      return 'android'
    }

    return 'web'
  }

  private detectBrowser(): { name: string; version?: string } {
    if (typeof window === 'undefined') {
      return { name: 'unknown' }
    }

    const userAgent = navigator.userAgent

    // Safari detection
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
      const version = userAgent.match(/Version\/([0-9.]+)/)
      return { name: 'safari', version: version?.[1] }
    }

    // Chrome detection
    if (/Chrome/.test(userAgent)) {
      const version = userAgent.match(/Chrome\/([0-9.]+)/)
      return { name: 'chrome', version: version?.[1] }
    }

    // Firefox detection
    if (/Firefox/.test(userAgent)) {
      const version = userAgent.match(/Firefox\/([0-9.]+)/)
      return { name: 'firefox', version: version?.[1] }
    }

    // Edge detection
    if (/Edg/.test(userAgent)) {
      const version = userAgent.match(/Edg\/([0-9.]+)/)
      return { name: 'edge', version: version?.[1] }
    }

    return { name: 'unknown' }
  }

  private detectMobile(): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  }

  private detectIOSSafari(): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    const userAgent = navigator.userAgent
    return /iPad|iPhone|iPod/.test(userAgent) && 
           /Safari/.test(userAgent) && 
           !/Chrome/.test(userAgent)
  }

  private detectCapabilities(
    platform: 'web' | 'ios' | 'android' | 'unknown',
    isIOSSafari: boolean
  ): AudioCapabilities {
    const baseCapabilities: AudioCapabilities = {
      canRecord: false,
      canPlayback: false,
      supportedFormats: [],
      maxRecordingDuration: 10 * 60 * 1000, // 10 minutes default
      hasVoiceActivityDetection: false,
      hasEchoCancellation: false,
      hasNoiseSuppression: false,
      requiresUserGesture: false,
    }

    if (typeof window === 'undefined') {
      return baseCapabilities
    }

    // Check basic audio support
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext)
    const hasMediaRecorder = !!window.MediaRecorder

    if (!hasMediaDevices || !hasMediaRecorder) {
      return baseCapabilities
    }

    // Detect supported formats
    const supportedFormats = this.detectSupportedFormats()

    // Platform-specific capabilities
    let capabilities = {
      ...baseCapabilities,
      canRecord: true,
      canPlayback: true,
      supportedFormats,
      hasVoiceActivityDetection: hasAudioContext,
      hasEchoCancellation: hasMediaDevices,
      hasNoiseSuppression: hasMediaDevices,
    }

    if (platform === 'ios' || isIOSSafari) {
      capabilities = {
        ...capabilities,
        requiresUserGesture: true,
        maxRecordingDuration: 5 * 60 * 1000, // iOS Safari has stricter limits
      }
    }

    if (platform === 'android') {
      capabilities = {
        ...capabilities,
        requiresUserGesture: false,
        maxRecordingDuration: 15 * 60 * 1000, // Android allows longer recordings
      }
    }

    return capabilities
  }

  private detectSupportedFormats(): AudioFormat[] {
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      return []
    }

    const supportedFormats: AudioFormat[] = []
    const mimeTypesToTest = Object.keys(MIME_TYPE_MAPPINGS)

    for (const mimeType of mimeTypesToTest) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        const format = getFormatFromMimeType(mimeType)
        if (!supportedFormats.includes(format)) {
          supportedFormats.push(format)
        }
      }
    }

    return supportedFormats
  }

  getOptimalAudioFormat(device?: DetectedDevice): AudioFormat {
    const detectedDevice = device || this.detectDevice()
    const platform = detectedDevice.platform

    if (platform === 'unknown') {
      return 'webm' // Default fallback
    }

    const deviceConfig = DEVICE_CONFIGS[platform === 'unknown' ? 'web' : platform]
    const supportedFormats = detectedDevice.capabilities.supportedFormats

    // Find the first preferred format that's supported
    for (const mimeType of deviceConfig.preferredMimeTypes) {
      const format = getFormatFromMimeType(mimeType)
      if (supportedFormats.includes(format)) {
        return format
      }
    }

    // Fallback to any supported format
    if (supportedFormats.length > 0) {
      return supportedFormats[0]
    }

    return 'webm' // Final fallback
  }

  getOptimalMimeType(device?: DetectedDevice): string {
    const detectedDevice = device || this.detectDevice()
    const platform = detectedDevice.platform

    if (platform === 'unknown' || typeof window === 'undefined') {
      return 'audio/webm'
    }

    const deviceConfig = DEVICE_CONFIGS[platform === 'unknown' ? 'web' : platform]

    // Test preferred MIME types in order
    for (const mimeType of deviceConfig.preferredMimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType
      }
    }

    // Test fallback MIME types
    for (const mimeType of deviceConfig.fallbackMimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType
      }
    }

    return 'audio/webm' // Final fallback
  }

  requiresUserGesture(device?: DetectedDevice): boolean {
    const detectedDevice = device || this.detectDevice()
    return detectedDevice.capabilities.requiresUserGesture
  }

  // Clear cache for testing purposes
  clearCache(): void {
    this.cachedDevice = null
  }
}

// Singleton instance for easy access
export const audioDeviceDetector = AudioDeviceDetector.getInstance()

// Utility functions for common use cases
export const getDeviceInfo = (): DetectedDevice => {
  return audioDeviceDetector.detectDevice()
}

export const getOptimalAudioFormat = (): AudioFormat => {
  return audioDeviceDetector.getOptimalAudioFormat()
}

export const getOptimalMimeType = (): string => {
  return audioDeviceDetector.getOptimalMimeType()
}

export const requiresUserGesture = (): boolean => {
  return audioDeviceDetector.requiresUserGesture()
}
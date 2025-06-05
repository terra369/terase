/**
 * Platform-agnostic audio validation utilities
 * Core audio validation for Web/React Native reusability
 */

import type { AudioBlob, AudioFormat } from './types'
import { 
  MAX_FILE_SIZES, 
  MIME_TYPE_MAPPINGS, 
  EXTENSION_MAPPINGS,
  VAD_CONFIG 
} from './config'

export interface AudioValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface AudioValidationOptions {
  maxSize?: number
  minDuration?: number
  maxDuration?: number
  allowedFormats?: AudioFormat[]
  requireAudio?: boolean
}

export class AudioValidator {
  static validateAudioBlob(
    audioBlob: AudioBlob, 
    options: AudioValidationOptions = {}
  ): AudioValidationResult {
    const result: AudioValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    // Validate file size
    this.validateFileSize(audioBlob, options, result)

    // Validate format
    this.validateFormat(audioBlob, options, result)

    // Validate duration
    this.validateDuration(audioBlob, options, result)

    // Validate blob content
    this.validateBlobContent(audioBlob, result)

    result.isValid = result.errors.length === 0

    return result
  }

  static validateRecordingFile(file: File | Blob): AudioValidationResult {
    const result: AudioValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    // Check if it's a valid file
    if (!file) {
      result.errors.push('ファイルが存在しません')
      result.isValid = false
      return result
    }

    // Check file size
    if (file.size === 0) {
      result.errors.push('ファイルが空です')
    } else if (file.size > MAX_FILE_SIZES.RECORDING) {
      result.errors.push(`ファイルサイズが大きすぎます (最大: ${MAX_FILE_SIZES.RECORDING / 1024 / 1024}MB)`)
    }

    // Check MIME type
    if (file.type && !this.isValidAudioMimeType(file.type)) {
      result.errors.push('サポートされていないオーディオ形式です')
    }

    result.isValid = result.errors.length === 0
    return result
  }

  static validateTranscriptionFile(file: File | Blob): AudioValidationResult {
    const result = this.validateRecordingFile(file)

    // Additional transcription-specific validation
    if (file.size > MAX_FILE_SIZES.TRANSCRIPTION) {
      result.errors.push(`転写用ファイルサイズが大きすぎます (最大: ${MAX_FILE_SIZES.TRANSCRIPTION / 1024 / 1024}MB)`)
    }

    result.isValid = result.errors.length === 0
    return result
  }

  static isValidAudioMimeType(mimeType: string): boolean {
    return Object.keys(MIME_TYPE_MAPPINGS).some(validType => 
      mimeType.startsWith(validType)
    )
  }

  static isValidAudioFormat(format: string): boolean {
    return Object.values(MIME_TYPE_MAPPINGS).includes(format as AudioFormat)
  }

  static getAudioFormatFromMimeType(mimeType: string): AudioFormat | null {
    for (const [mime, format] of Object.entries(MIME_TYPE_MAPPINGS)) {
      if (mimeType.startsWith(mime)) {
        return format
      }
    }
    return null
  }

  static getFileExtensionFromFormat(format: AudioFormat): string {
    return EXTENSION_MAPPINGS[format] || '.audio'
  }

  static estimateAudioDuration(fileSize: number, format: AudioFormat): number {
    // Rough estimates based on typical bitrates
    const estimatedBitrates: Record<AudioFormat, number> = {
      wav: 1411, // kbps for 44.1kHz 16-bit stereo
      mp3: 128,
      mp4: 128,
      m4a: 128,
      webm: 64,
    }

    const bitrate = estimatedBitrates[format] || 128
    return (fileSize * 8) / (bitrate * 1000) // Convert to seconds
  }

  static validateRecordingDuration(
    duration: number,
    minDuration: number = VAD_CONFIG.minimumRecordingMs / 1000,
    maxDuration: number = VAD_CONFIG.maxRecordingMs / 1000
  ): AudioValidationResult {
    const result: AudioValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    if (duration < minDuration) {
      result.errors.push(`録音時間が短すぎます (最小: ${minDuration}秒)`)
    }

    if (duration > maxDuration) {
      result.errors.push(`録音時間が長すぎます (最大: ${maxDuration}秒)`)
    }

    result.isValid = result.errors.length === 0
    return result
  }

  private static validateFileSize(
    audioBlob: AudioBlob,
    options: AudioValidationOptions,
    result: AudioValidationResult
  ): void {
    const maxSize = options.maxSize || MAX_FILE_SIZES.RECORDING

    if (audioBlob.size === 0) {
      result.errors.push('オーディオファイルが空です')
    } else if (audioBlob.size > maxSize) {
      result.errors.push(`ファイルサイズが大きすぎます (最大: ${maxSize / 1024 / 1024}MB)`)
    }

    // Warning for unusually small files
    if (audioBlob.size < 1024) { // Less than 1KB
      result.warnings.push('ファイルサイズが小さすぎる可能性があります')
    }
  }

  private static validateFormat(
    audioBlob: AudioBlob,
    options: AudioValidationOptions,
    result: AudioValidationResult
  ): void {
    if (options.allowedFormats && !options.allowedFormats.includes(audioBlob.format)) {
      result.errors.push(`サポートされていない形式です: ${audioBlob.format}`)
    }

    if (!this.isValidAudioFormat(audioBlob.format)) {
      result.errors.push(`無効なオーディオ形式です: ${audioBlob.format}`)
    }
  }

  private static validateDuration(
    audioBlob: AudioBlob,
    options: AudioValidationOptions,
    result: AudioValidationResult
  ): void {
    if (audioBlob.duration !== undefined) {
      if (options.minDuration && audioBlob.duration < options.minDuration) {
        result.errors.push(`録音時間が短すぎます (最小: ${options.minDuration}秒)`)
      }

      if (options.maxDuration && audioBlob.duration > options.maxDuration) {
        result.errors.push(`録音時間が長すぎます (最大: ${options.maxDuration}秒)`)
      }
    } else {
      // Estimate duration from file size if not provided
      const estimatedDuration = this.estimateAudioDuration(audioBlob.size, audioBlob.format)
      
      if (options.minDuration && estimatedDuration < options.minDuration) {
        result.warnings.push('録音時間が短い可能性があります')
      }
    }
  }

  private static validateBlobContent(
    audioBlob: AudioBlob,
    result: AudioValidationResult
  ): void {
    if (!audioBlob.blob) {
      result.errors.push('オーディオデータが存在しません')
      return
    }

    // Check blob type
    if (audioBlob.blob.type && !this.isValidAudioMimeType(audioBlob.blob.type)) {
      result.warnings.push('BlobのMIMEタイプが一致しません')
    }

    // Check blob size consistency
    if (audioBlob.blob.size !== audioBlob.size) {
      result.warnings.push('ファイルサイズの情報が一致しません')
    }
  }
}

// Utility functions for common validation scenarios
export const validateRecording = (audioBlob: AudioBlob): AudioValidationResult => {
  return AudioValidator.validateAudioBlob(audioBlob, {
    maxSize: MAX_FILE_SIZES.RECORDING,
    minDuration: VAD_CONFIG.minimumRecordingMs / 1000,
    maxDuration: VAD_CONFIG.maxRecordingMs / 1000,
  })
}

export const validateTranscription = (audioBlob: AudioBlob): AudioValidationResult => {
  return AudioValidator.validateAudioBlob(audioBlob, {
    maxSize: MAX_FILE_SIZES.TRANSCRIPTION,
    allowedFormats: ['wav', 'mp3', 'mp4', 'm4a', 'webm'],
  })
}

export const isValidRecordingFile = (file: File | Blob): boolean => {
  const result = AudioValidator.validateRecordingFile(file)
  return result.isValid
}

export const isValidTranscriptionFile = (file: File | Blob): boolean => {
  const result = AudioValidator.validateTranscriptionFile(file)
  return result.isValid
}

export const getValidationErrors = (audioBlob: AudioBlob): string[] => {
  const result = AudioValidator.validateAudioBlob(audioBlob)
  return result.errors
}
/**
 * Platform-agnostic validation utilities
 * Core validation functions for Web/React Native reusability
 */

import { z } from 'zod'
import type { ErrorCategory } from '../api/types'
import { ErrorHandler } from './error-handling'

// Common validation schemas
export const emailSchema = z.string().email('有効なメールアドレスを入力してください')

export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  '日付はYYYY-MM-DD形式で入力してください'
)

export const urlSchema = z.string().url('有効なURLを入力してください')

export const phoneSchema = z.string().regex(
  /^[\+]?[1-9][\d]{0,15}$/,
  '有効な電話番号を入力してください'
)

// Text validation
export const createTextSchema = (
  minLength: number = 1,
  maxLength: number = 1000,
  required: boolean = true
) => {
  let schema = z.string()
  
  if (required) {
    schema = schema.min(minLength, `${minLength}文字以上入力してください`)
  } else {
    schema = schema.optional()
  }
  
  return schema.max(maxLength, `${maxLength}文字以内で入力してください`)
}

// Number validation
export const createNumberSchema = (
  min?: number,
  max?: number,
  isInteger: boolean = false
) => {
  let schema = isInteger ? z.number().int('整数を入力してください') : z.number()
  
  if (min !== undefined) {
    schema = schema.min(min, `${min}以上の値を入力してください`)
  }
  
  if (max !== undefined) {
    schema = schema.max(max, `${max}以下の値を入力してください`)
  }
  
  return schema
}

// File validation
export interface FileValidationOptions {
  maxSize?: number
  allowedTypes?: string[]
  requiredExtensions?: string[]
}

export const validateFile = (
  file: File | Blob,
  options: FileValidationOptions = {}
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  // Size validation
  if (options.maxSize && file.size > options.maxSize) {
    const maxSizeMB = Math.round(options.maxSize / 1024 / 1024)
    errors.push(`ファイルサイズは${maxSizeMB}MB以下にしてください`)
  }
  
  // Type validation
  if (file instanceof File) {
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push('サポートされていないファイル形式です')
    }
    
    if (options.requiredExtensions) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (!fileExtension || !options.requiredExtensions.includes(fileExtension)) {
        errors.push(`ファイルの拡張子は${options.requiredExtensions.join(', ')}のいずれかにしてください`)
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Audio file validation
export const validateAudioFile = (file: File | Blob) => {
  return validateFile(file, {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/webm',
    ],
    requiredExtensions: ['wav', 'mp3', 'mp4', 'm4a', 'webm'],
  })
}

// Image file validation
export const validateImageFile = (file: File | Blob) => {
  return validateFile(file, {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
    requiredExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  })
}

// Date validation utilities
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0]
}

export const isDateInRange = (
  dateString: string,
  startDate?: string,
  endDate?: string
): boolean => {
  const date = new Date(dateString)
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null
  
  if (start && date < start) return false
  if (end && date > end) return false
  
  return true
}

export const isDateInFuture = (dateString: string): boolean => {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date > today
}

export const isDateInPast = (dateString: string): boolean => {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date < today
}

// Text content validation
export const validateTextContent = (
  text: string,
  options: {
    minLength?: number
    maxLength?: number
    allowEmpty?: boolean
    trimWhitespace?: boolean
  } = {}
): { isValid: boolean; errors: string[]; cleanedText?: string } => {
  const errors: string[] = []
  let cleanedText = options.trimWhitespace !== false ? text.trim() : text
  
  // Empty check
  if (!options.allowEmpty && cleanedText.length === 0) {
    errors.push('内容を入力してください')
    return { isValid: false, errors }
  }
  
  // Length validation
  if (options.minLength && cleanedText.length < options.minLength) {
    errors.push(`${options.minLength}文字以上入力してください`)
  }
  
  if (options.maxLength && cleanedText.length > options.maxLength) {
    errors.push(`${options.maxLength}文字以内で入力してください`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cleanedText,
  }
}

// Safe validation wrapper
export const safeValidate = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } => {
  try {
    const result = schema.safeParse(data)
    
    if (result.success) {
      return { success: true, data: result.data }
    } else {
      const errorMessage = result.error.errors
        .map(err => err.message)
        .join(', ')
      
      return { success: false, error: errorMessage }
    }
  } catch (error) {
    const terazeError = ErrorHandler.fromUnknown(error, 'validation')
    return { success: false, error: terazeError.userMessage }
  }
}

// Validation error formatter
export const formatValidationErrors = (errors: z.ZodError): string[] => {
  return errors.errors.map(error => {
    const path = error.path.length > 0 ? `${error.path.join('.')}: ` : ''
    return `${path}${error.message}`
  })
}

// Common validation patterns
export const ValidationPatterns = {
  // Japanese text (hiragana, katakana, kanji)
  japanese: /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\s]+$/,
  
  // Alphanumeric with some symbols
  username: /^[a-zA-Z0-9_-]+$/,
  
  // Password (at least 8 chars, one letter, one number)
  password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/,
  
  // Japanese phone number
  japanesePhone: /^0\d{1,4}-\d{1,4}-\d{4}$/,
  
  // URL slug
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  
  // Time format (HH:MM)
  time: /^([01]?\d|2[0-3]):[0-5]\d$/,
  
  // Duration format (MM:SS or HH:MM:SS)
  duration: /^(?:([01]?\d|2[0-3]):)?([0-5]?\d):([0-5]\d)$/,
}

// Validation helper functions
export const isValidJapaneseText = (text: string): boolean => {
  return ValidationPatterns.japanese.test(text)
}

export const isValidUsername = (username: string): boolean => {
  return ValidationPatterns.username.test(username)
}

export const isValidPassword = (password: string): boolean => {
  return ValidationPatterns.password.test(password)
}

export const isValidTime = (time: string): boolean => {
  return ValidationPatterns.time.test(time)
}

export const isValidDuration = (duration: string): boolean => {
  return ValidationPatterns.duration.test(duration)
}

// Sanitization utilities
export const sanitizeText = (text: string): string => {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[<>]/g, '') // Remove potential HTML chars
}

export const sanitizeHTML = (html: string): string => {
  // Basic HTML sanitization - for production use a proper library like DOMPurify
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .trim()
}
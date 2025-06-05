/**
 * Core diary validation schemas
 * Shared between Web and Mobile platforms
 */

import { z } from 'zod'

export const diaryDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

export const diaryTextSchema = z.string().min(1, 'Text cannot be empty').max(5000, 'Text too long')

export const visibilitySchema = z.enum(['friends', 'private'])

export const roleSchema = z.enum(['user', 'ai'])

export const audioUrlSchema = z.string().url().optional()

export const createDiarySchema = z.object({
  date: diaryDateSchema,
  user_text: diaryTextSchema.optional(),
  visibility: visibilitySchema.default('friends')
})

export const updateDiarySchema = z.object({
  user_text: diaryTextSchema.optional(),
  fairy_text: diaryTextSchema.optional(),
  user_audio_url: audioUrlSchema,
  fairy_audio_url: audioUrlSchema
}).partial()

export const saveMessageSchema = z.object({
  role: roleSchema,
  text: diaryTextSchema,
  audio_url: audioUrlSchema
})

export const saveDiaryWithAudioSchema = z.object({
  date: diaryDateSchema.optional(),
  text: diaryTextSchema,
  audioPath: z.string().min(1, 'Audio path is required')
})

export const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: diaryTextSchema
})

export const conversationHistorySchema = z.array(conversationMessageSchema)

// Form data validation schemas
export const diaryFormDataSchema = z.object({
  date: diaryDateSchema,
  text: diaryTextSchema,
  audioPath: z.string().min(1, 'Audio path is required')
})

// API request validation schemas
export const apiCreateDiarySchema = z.object({
  date: diaryDateSchema.optional(),
  userText: diaryTextSchema.optional(),
  visibility: visibilitySchema.optional()
})

export const apiSaveMessageSchema = z.object({
  diaryId: z.number().positive(),
  role: roleSchema,
  text: diaryTextSchema,
  audioUrl: audioUrlSchema
})

export const apiUpdateDiarySchema = z.object({
  diaryId: z.number().positive(),
  updates: updateDiarySchema
})

// Validation utility functions
export const DiaryValidation = {
  /**
   * Validate diary creation input
   */
  validateCreateDiary(input: unknown) {
    return createDiarySchema.parse(input)
  },

  /**
   * Validate diary update input
   */
  validateUpdateDiary(input: unknown) {
    return updateDiarySchema.parse(input)
  },

  /**
   * Validate message input
   */
  validateMessage(input: unknown) {
    return saveMessageSchema.parse(input)
  },

  /**
   * Validate form data for diary saving
   */
  validateFormData(formData: FormData) {
    return diaryFormDataSchema.parse({
      date: formData.get('date'),
      text: formData.get('text'),
      audioPath: formData.get('audioPath')
    })
  },

  /**
   * Validate conversation history
   */
  validateConversationHistory(input: unknown) {
    return conversationHistorySchema.parse(input)
  },

  /**
   * Check if date is valid and not in the future
   */
  isValidDiaryDate(dateString: string): boolean {
    try {
      diaryDateSchema.parse(dateString)
      const date = new Date(dateString)
      const today = new Date()
      today.setHours(23, 59, 59, 999) // Allow entries for today
      return date <= today
    } catch {
      return false
    }
  },

  /**
   * Get today's date in diary format
   */
  getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
  },

  /**
   * Sanitize text input
   */
  sanitizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ')
  },

  /**
   * Check if text meets minimum quality requirements
   */
  isValidDiaryText(text: string): boolean {
    const sanitized = DiaryValidation.sanitizeText(text)
    return sanitized.length >= 1 && sanitized.length <= 5000
  }
} as const

// Type exports for use in other modules
export type CreateDiaryInput = z.infer<typeof createDiarySchema>
export type UpdateDiaryInput = z.infer<typeof updateDiarySchema>
export type SaveMessageInput = z.infer<typeof saveMessageSchema>
export type ConversationMessage = z.infer<typeof conversationMessageSchema>
export type DiaryFormData = z.infer<typeof diaryFormDataSchema>
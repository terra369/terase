/**
 * Platform-agnostic API schemas and validation
 * Extracted from src/lib/api/schemas.ts for Web/React Native reusability
 */

import { z } from 'zod'

// Common validation helpers
const audioFileSchema = z.object({
  type: z.string().regex(/^audio\//, 'File must be an audio type'),
  size: z.number().max(50 * 1024 * 1024, 'File size must be less than 50MB'),
})

// API Request/Response Schemas
export const AIChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
  diaryId: z.number().optional(),
  context: z.string().optional(),
})

export const TranscribeSchema = z.object({
  audio: audioFileSchema,
  language: z.string().optional().default('ja'),
})

export const TTSSchema = z.object({
  text: z.string().min(1, 'Text is required').max(4000, 'Text too long'),
  voice: z.string().optional().default('alloy'),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0),
})

export const SaveDiarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  userText: z.string().min(1, 'Diary content is required'),
  userAudioUrl: z.string().url().optional(),
  visibility: z.enum(['friends', 'private']).default('friends'),
})

export const DiaryMessageSchema = z.object({
  diaryId: z.number().positive('Invalid diary ID'),
  role: z.enum(['user', 'ai']),
  text: z.string().min(1, 'Message text is required'),
  audioUrl: z.string().url().optional(),
})

export const GetDiarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
})

export const ListDiariesSchema = z.object({
  year: z.number().min(2020).max(2030).optional(),
  month: z.number().min(1).max(12).optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
})

// Response schemas
export const APIErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
})

export const DiarySchema = z.object({
  id: z.number(),
  date: z.string(),
  userText: z.string(),
  fairyText: z.string().nullable(),
  userAudioUrl: z.string().nullable(),
  fairyAudioUrl: z.string().nullable(),
  visibility: z.string(),
  createdAt: z.string(),
})

export const DiaryMessageResponseSchema = z.object({
  id: z.number(),
  diaryId: z.number(),
  role: z.string(),
  text: z.string(),
  audioUrl: z.string().nullable(),
  createdAt: z.string(),
})

// Type exports
export type AIChatRequest = z.infer<typeof AIChatSchema>
export type TranscribeRequest = z.infer<typeof TranscribeSchema>
export type TTSRequest = z.infer<typeof TTSSchema>
export type SaveDiaryRequest = z.infer<typeof SaveDiarySchema>
export type DiaryMessageRequest = z.infer<typeof DiaryMessageSchema>
export type GetDiaryRequest = z.infer<typeof GetDiarySchema>
export type ListDiariesRequest = z.infer<typeof ListDiariesSchema>

export type APIError = z.infer<typeof APIErrorSchema>
export type Diary = z.infer<typeof DiarySchema>
export type DiaryMessage = z.infer<typeof DiaryMessageResponseSchema>

// Schema validation helpers
export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`)
  }
  return result.data
}

export const isValidSchema = <T>(schema: z.ZodSchema<T>, data: unknown): data is T => {
  return schema.safeParse(data).success
}
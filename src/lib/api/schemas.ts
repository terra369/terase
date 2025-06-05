import { z } from 'zod';

/**
 * Input validation schemas for API routes
 */

// AI Chat Schema
export const AIChatSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message is too long (max 1000 characters)'),
  context: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
});

export type AIChatInput = z.infer<typeof AIChatSchema>;

// Diary Message Schema
export const DiaryMessageSchema = z.object({
  diaryId: z.number().int().positive(),
  content: z.string().min(1, 'Content cannot be empty'),
  speaker: z.enum(['user', 'ai']),
  audioUrl: z.string().url().optional()
});

export type DiaryMessageInput = z.infer<typeof DiaryMessageSchema>;

// Save Diary Schema
export const SaveDiarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  userText: z.string().min(1, 'User text cannot be empty'),
  fairyText: z.string().optional(),
  userAudioUrl: z.string().url().optional(),
  fairyAudioUrl: z.string().url().optional(),
  visibility: z.enum(['friends', 'private']).default('friends')
});

export type SaveDiaryInput = z.infer<typeof SaveDiarySchema>;

// TTS Schema
export const TTSSchema = z.object({
  text: z.string()
    .min(1, 'Text cannot be empty')
    .max(4000, 'Text is too long for TTS (max 4000 characters)'),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('alloy'),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0)
});

export type TTSInput = z.infer<typeof TTSSchema>;

// File Upload Schema (for transcription)
export const FileUploadSchema = z.object({
  maxSize: z.number().default(25 * 1024 * 1024), // 25MB default
  allowedTypes: z.array(z.string()).default(['audio/wav', 'audio/mp3', 'audio/webm', 'audio/mp4', 'audio/mpeg'])
});

export type FileUploadConfig = z.infer<typeof FileUploadSchema>;

// Date Parameter Schema (for diary routes)
export const DateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
});

export type DateParam = z.infer<typeof DateParamSchema>;

// Query Parameters Schema (for diary list)
export const DiaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export type DiaryQuery = z.infer<typeof DiaryQuerySchema>;

/**
 * Utility function to validate request body with proper error handling
 */
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: { general: ['Validation failed'] }
    };
  }
}

/**
 * Utility function to validate query parameters
 */
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const params: Record<string, string> = {};
  
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  return validateRequestBody(schema, params);
}

/**
 * Validate file upload (multipart form data)
 */
export function validateFileUpload(
  file: File, 
  config: FileUploadConfig = FileUploadSchema.parse({})
): { success: true } | { success: false; error: string } {
  // Check file size
  if (file.size > config.maxSize) {
    return { 
      success: false, 
      error: `File size exceeds limit (${Math.round(config.maxSize / 1024 / 1024)}MB)` 
    };
  }
  
  // Check file type
  if (!config.allowedTypes.includes(file.type)) {
    return { 
      success: false, 
      error: `File type not allowed. Allowed types: ${config.allowedTypes.join(', ')}` 
    };
  }
  
  return { success: true };
}
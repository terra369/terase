/**
 * API schemas - now extends core platform-agnostic schemas
 * This file provides backward compatibility while leveraging the new core module
 */

// Re-export core schemas for compatibility
export {
  AIChatSchema,
  TranscribeSchema,
  TTSSchema,
  SaveDiarySchema,
  DiaryMessageSchema,
  GetDiarySchema,
  ListDiariesSchema,
  validateSchema,
  isValidSchema
} from '../../../core/api/schemas';

// Re-export types with legacy names for compatibility
export type {
  AIChatRequest as AIChatInput,
  TranscribeRequest,
  TTSRequest,
  SaveDiaryRequest,
  DiaryMessageRequest as DiaryMessageInput,
  GetDiaryRequest,
  ListDiariesRequest,
  Diary,
  DiaryMessage
} from '../../../core/api/schemas';

import { z } from 'zod';

// Legacy schemas for backward compatibility - keeping existing names
export type SaveDiaryInput = SaveDiaryRequest;
export type TTSInput = TTSRequest;

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
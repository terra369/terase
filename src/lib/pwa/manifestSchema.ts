import { z } from 'zod';

// Icon schema
const IconSchema = z.object({
  src: z.string(),
  sizes: z.string().regex(/^\d+x\d+$/),
  type: z.string(),
  purpose: z.string().optional(),
});

// Screenshot schema
const ScreenshotSchema = z.object({
  src: z.string(),
  sizes: z.string().regex(/^\d+x\d+$/),
  type: z.string(),
  form_factor: z.enum(['narrow', 'wide']).optional(),
  platform: z.string().optional(), // For platform-specific screenshots
});

// Main manifest schema
export const ManifestSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().min(1),
  description: z.string().optional(),
  theme_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  display: z.enum(['fullscreen', 'standalone', 'minimal-ui', 'browser']),
  orientation: z.enum([
    'any',
    'natural',
    'landscape',
    'landscape-primary',
    'landscape-secondary',
    'portrait',
    'portrait-primary',
    'portrait-secondary',
  ]).optional(),
  scope: z.string(),
  start_url: z.string(),
  lang: z.string().optional(),
  dir: z.enum(['ltr', 'rtl', 'auto']).optional(),
  icons: z.array(IconSchema).min(1),
  screenshots: z.array(ScreenshotSchema).optional(),
  categories: z.array(z.string()).optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

// Validation function with error details
export function validateManifest(manifest: unknown): { 
  valid: boolean; 
  data?: Manifest; 
  errors?: z.ZodError['errors'] 
} {
  const result = ManifestSchema.safeParse(manifest);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  return { valid: false, errors: result.error.errors };
}

// Helper to validate manifest from JSON string
export function validateManifestJSON(jsonString: string): { 
  valid: boolean; 
  data?: Manifest; 
  errors?: z.ZodError['errors'] | { message: string }[] 
} {
  try {
    const manifest = JSON.parse(jsonString);
    return validateManifest(manifest);
  } catch (error) {
    return { 
      valid: false, 
      errors: [{ message: 'Invalid JSON format' }] 
    };
  }
}
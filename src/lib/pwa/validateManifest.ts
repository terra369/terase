import { readFileSync } from 'fs';
import { join } from 'path';
import { validateManifestJSON } from './manifestSchema';

/**
 * Validates the public/manifest.json file at build time
 * @returns validation result with data or errors
 */
export function validatePublicManifest() {
  const manifestPath = join(process.cwd(), 'public', 'manifest.json');
  
  try {
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    const result = validateManifestJSON(manifestContent);
    
    if (!result.valid) {
      console.error('❌ manifest.json validation failed:');
      result.errors?.forEach((error) => {
        if ('path' in error && error.path) {
          console.error(`  - ${(error.path as (string | number)[]).join('.')}: ${error.message}`);
        } else {
          console.error(`  - ${error.message}`);
        }
      });
      throw new Error('Invalid manifest.json');
    }
    
    console.log('✅ manifest.json validation passed');
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid manifest.json') {
      throw error;
    }
    
    console.error('❌ Failed to read manifest.json:', error);
    throw new Error('Failed to read manifest.json');
  }
}

/**
 * Runtime validation for manifest data
 * Can be used in tests or runtime checks
 */
export { validateManifest, validateManifestJSON } from './manifestSchema';
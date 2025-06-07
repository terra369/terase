import { describe, it, expect } from 'vitest';
import { ManifestSchema, validateManifest, validateManifestJSON } from '../lib/pwa/manifestSchema';

describe('Manifest Schema Validation', () => {
  describe('Valid Manifests', () => {
    it('should validate a minimal valid manifest', () => {
      const manifest = {
        name: 'Test App',
        short_name: 'Test',
        theme_color: '#ffffff',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(manifest);
    });

    it('should validate a complete manifest with all optional fields', () => {
      const manifest = {
        name: 'Complete Test App',
        short_name: 'Complete',
        description: 'A complete test application',
        theme_color: '#123456',
        background_color: '#abcdef',
        display: 'fullscreen',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'ja',
        dir: 'ltr',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/mobile-1.png',
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
          },
        ],
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(manifest);
    });
  });

  describe('Invalid Manifests', () => {
    it('should fail with invalid theme color format', () => {
      const manifest = {
        name: 'Test App',
        short_name: 'Test',
        theme_color: 'invalid-color',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].path).toContain('theme_color');
    });

    it('should fail with invalid icon size format', () => {
      const manifest = {
        name: 'Test App',
        short_name: 'Test',
        theme_color: '#ffffff',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.png',
            sizes: 'invalid-size',
            type: 'image/png',
          },
        ],
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].path).toContain('sizes');
    });

    it('should fail with missing required fields', () => {
      const manifest = {
        name: 'Test App',
        // Missing short_name, theme_color, etc.
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(1);
    });

    it('should fail with invalid display value', () => {
      const manifest = {
        name: 'Test App',
        short_name: 'Test',
        theme_color: '#ffffff',
        background_color: '#000000',
        display: 'invalid-display',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].path).toContain('display');
    });

    it('should fail with empty icons array', () => {
      const manifest = {
        name: 'Test App',
        short_name: 'Test',
        theme_color: '#ffffff',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [],
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].path).toContain('icons');
    });
  });

  describe('JSON Validation', () => {
    it('should validate valid JSON string', () => {
      const jsonString = JSON.stringify({
        name: 'Test App',
        short_name: 'Test',
        theme_color: '#ffffff',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      });

      const result = validateManifestJSON(jsonString);
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid JSON format', () => {
      const invalidJSON = '{ invalid json }';
      
      const result = validateManifestJSON(invalidJSON);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0].message).toBe('Invalid JSON format');
    });
  });

  describe('Real manifest.json validation', () => {
    it('should validate the actual public/manifest.json file', () => {
      // This test imports and validates the actual manifest file
      const fs = require('fs');
      const path = require('path');
      
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      
      const result = validateManifestJSON(manifestContent);
      
      if (!result.valid) {
        console.error('Actual manifest.json validation errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
    });
  });
});
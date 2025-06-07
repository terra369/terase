import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { validateManifestJSON } from '../lib/pwa/validateManifest';

describe('PWA Visual Assets', () => {
  const publicDir = path.join(process.cwd(), 'public');
  
  describe('PWA Icons', () => {
    it('should have a 192x192 PWA icon', () => {
      const iconPath = path.join(publicDir, 'icon-192x192.png');
      const exists = fs.existsSync(iconPath);
      expect(exists).toBe(true);
    });

    it('should have a 512x512 PWA icon', () => {
      const iconPath = path.join(publicDir, 'icon-512x512.png');
      const exists = fs.existsSync(iconPath);
      expect(exists).toBe(true);
    });

    it('should have an apple-touch-icon (180x180)', () => {
      const iconPath = path.join(publicDir, 'apple-touch-icon.png');
      const exists = fs.existsSync(iconPath);
      expect(exists).toBe(true);
    });

    it('should have a favicon.ico', () => {
      const iconPath = path.join(publicDir, 'favicon.ico');
      const exists = fs.existsSync(iconPath);
      expect(exists).toBe(true);
    });
  });

  describe('Manifest.json Configuration', () => {
    let manifest: {
      theme_color?: string;
      background_color?: string;
      icons?: Array<{
        src: string;
        sizes: string;
        type: string;
        purpose?: string;
      }>;
      screenshots?: Array<{
        src: string;
        sizes: string;
        type: string;
        platform?: string;
      }>;
    };

    beforeAll(() => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    });

    it('should pass Zod schema validation', () => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const validationResult = validateManifestJSON(manifestContent);
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toBeUndefined();
      expect(validationResult.data).toBeDefined();
    });

    it('should have theme_color matching the app theme', () => {
      expect(manifest.theme_color).toBeDefined();
      // Should match the mobile app background color
      expect(manifest.theme_color).toBe('#ecedf3');
    });

    it('should have proper background_color', () => {
      expect(manifest.background_color).toBeDefined();
      expect(manifest.background_color).toBe('#ecedf3');
    });

    it('should have maskable icon configured', () => {
      const maskableIcon = manifest.icons?.find((icon) => 
        icon.purpose?.includes('maskable')
      );
      expect(maskableIcon).toBeDefined();
      expect(maskableIcon?.sizes).toMatch(/192x192|512x512/);
    });

    it('should have screenshots configured', () => {
      expect(manifest.screenshots).toBeDefined();
      expect(Array.isArray(manifest.screenshots)).toBe(true);
      expect(manifest.screenshots.length).toBeGreaterThan(0);
      
      // Check screenshot structure
      manifest.screenshots?.forEach((screenshot) => {
        expect(screenshot).toHaveProperty('src');
        expect(screenshot).toHaveProperty('sizes');
        expect(screenshot).toHaveProperty('type');
        // Validate size format
        expect(screenshot.sizes).toMatch(/^\d+x\d+$/);
      });
    });
  });

  describe('Screenshot Validation', () => {
    it('should have proper screenshot dimensions', async () => {
      const screenshotPath = path.join(publicDir, 'screenshots/mobile-1.png');
      
      // Check if screenshot exists
      expect(fs.existsSync(screenshotPath)).toBe(true);
      
      // Verify image dimensions using sharp
      const metadata = await sharp(screenshotPath).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
      expect(metadata.format).toBe('png');
    });

    it('should have all screenshots with correct dimensions', async () => {
      const screenshotDir = path.join(publicDir, 'screenshots');
      const screenshots = fs.readdirSync(screenshotDir)
        .filter(file => file.endsWith('.png'));
      
      expect(screenshots.length).toBeGreaterThan(0);
      
      // Check each screenshot
      for (const screenshot of screenshots) {
        const screenshotPath = path.join(screenshotDir, screenshot);
        const metadata = await sharp(screenshotPath).metadata();
        
        // Mobile screenshots should be 1080x1920
        if (screenshot.includes('mobile')) {
          expect(metadata.width).toBe(1080);
          expect(metadata.height).toBe(1920);
        }
        
        expect(metadata.format).toBe('png');
      }
    });

    it('should have valid PWA icon dimensions', async () => {
      const iconTests = [
        { file: 'icon-192x192.png', width: 192, height: 192 },
        { file: 'icon-384x384.png', width: 384, height: 384 },
        { file: 'icon-512x512.png', width: 512, height: 512 },
        { file: 'apple-touch-icon.png', width: 180, height: 180 }
      ];
      
      for (const { file, width, height } of iconTests) {
        const iconPath = path.join(publicDir, file);
        
        if (fs.existsSync(iconPath)) {
          const metadata = await sharp(iconPath).metadata();
          expect(metadata.width).toBe(width);
          expect(metadata.height).toBe(height);
          expect(metadata.format).toBe('png');
        }
      }
    });
  });

  describe('iOS Meta Tags', () => {
    it('should have apple-touch-icon in metadata', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Check if metadata includes apple-touch-icon
      expect(layoutContent).toMatch(/apple:\s*\[[\s\S]*?url:\s*['"]\/apple-touch-icon\.png['"]/);
    });

    it('should have apple-mobile-web-app-capable meta tag', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Check for apple-mobile-web-app-capable in metadata
      expect(layoutContent).toMatch(/appleWebApp:\s*{[\s\S]*?capable:\s*true/);
    });

    it('should have apple-mobile-web-app-status-bar-style meta tag', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Check for status bar style in metadata
      expect(layoutContent).toMatch(/appleWebApp:\s*{[\s\S]*?statusBarStyle:\s*['"]default['"]/);
    });

    it('should have theme-color meta tag matching app theme', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Check for theme color in metadata
      expect(layoutContent).toMatch(/themeColor:\s*['"]#ecedf3['"]/);
    });
  });
});
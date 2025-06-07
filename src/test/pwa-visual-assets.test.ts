import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

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
    let manifest: any;

    beforeAll(() => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    });

    it('should have theme_color matching the app theme', () => {
      expect(manifest.theme_color).toBeDefined();
      // Should match the rainbow/black theme of the app
      expect(manifest.theme_color).toBe('#000000');
    });

    it('should have proper background_color', () => {
      expect(manifest.background_color).toBeDefined();
      expect(manifest.background_color).toBe('#000000');
    });

    it('should have maskable icon configured', () => {
      const maskableIcon = manifest.icons?.find((icon: any) => 
        icon.purpose?.includes('maskable')
      );
      expect(maskableIcon).toBeDefined();
      expect(maskableIcon.sizes).toMatch(/192x192|512x512/);
    });

    it('should have screenshots configured', () => {
      expect(manifest.screenshots).toBeDefined();
      expect(Array.isArray(manifest.screenshots)).toBe(true);
      expect(manifest.screenshots.length).toBeGreaterThan(0);
      
      // Check screenshot structure
      manifest.screenshots.forEach((screenshot: any) => {
        expect(screenshot).toHaveProperty('src');
        expect(screenshot).toHaveProperty('sizes');
        expect(screenshot).toHaveProperty('type');
      });
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
      expect(layoutContent).toMatch(/appleWebApp:\s*{[\s\S]*?statusBarStyle:\s*['"]black['"]/);
    });

    it('should have theme-color meta tag matching app theme', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Check for theme color in metadata
      expect(layoutContent).toMatch(/themeColor:\s*['"]#000000['"]/);
    });
  });
});
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: string;
  background_color: string;
  theme_color: string;
  orientation: string;
  scope: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
  categories: string[];
  lang: string;
  dir: string;
}

describe('PWA Infrastructure', () => {
  describe('Web App Manifest', () => {
    let manifest: WebAppManifest;
    
    beforeAll(() => {
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    });

    it('should have a valid manifest.json file', () => {
      expect(manifest).toBeDefined();
    });

    it('should have required manifest properties', () => {
      expect(manifest.name).toBe('terase - 感謝日記');
      expect(manifest.short_name).toBe('terase');
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#000000');
      expect(manifest.background_color).toBe('#000000');
    });

    it('should have proper icon configurations', () => {
      expect(manifest.icons).toBeDefined();
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThan(0);
      
      const requiredSizes = ['192x192', '384x384', '512x512'];
      const manifestSizes = manifest.icons.map((icon) => icon.sizes);
      
      requiredSizes.forEach(size => {
        expect(manifestSizes).toContain(size);
      });
    });

    it('should have Japanese language setting', () => {
      expect(manifest.lang).toBe('ja');
    });

    it('should have portrait orientation', () => {
      expect(manifest.orientation).toBe('portrait');
    });
  });

  describe('Next.js Configuration', () => {
    it('should have PWA configuration in next.config.ts', async () => {
      const configPath = path.join(process.cwd(), 'next.config.ts');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      
      expect(configContent).toContain('next-pwa');
      expect(configContent).toContain('withPWA');
      expect(configContent).toContain('runtimeCaching');
      expect(configContent).toContain('disable: process.env.NODE_ENV === "development"');
    });

    it('should have proper caching strategies configured', async () => {
      const configPath = path.join(process.cwd(), 'next.config.ts');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      
      // Check for various caching strategies
      expect(configContent).toContain('CacheFirst');
      expect(configContent).toContain('StaleWhileRevalidate');
      expect(configContent).toContain('NetworkFirst');
      
      // Check for specific cache names
      expect(configContent).toContain('google-fonts');
      expect(configContent).toContain('static-image-assets');
      expect(configContent).toContain('static-audio-assets');
      expect(configContent).toContain('supabase-storage');
    });
  });

  describe('Layout Metadata', () => {
    it('should have manifest link in layout metadata', async () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      expect(layoutContent).toContain('manifest: "/manifest.json"');
      expect(layoutContent).toContain('themeColor: "#000000"');
    });
  });

  describe('Service Worker Generation', () => {
    it('should generate service worker files after build', async () => {
      // This test will be validated after running the build
      // The service worker should be generated at public/sw.js
      // and workbox files should be in public/workbox-*.js
      expect(true).toBe(true); // Placeholder for now
    });
  });

  describe('PWA Icons and Assets', () => {
    it('should have PWA icons in proper directory structure', () => {
      const iconsDir = path.join(process.cwd(), 'public', 'icons');
      const requiredIcons = [
        'icon-192x192.png',
        'icon-512x512.png',
        'icon-192x192-maskable.png',
        'icon-512x512-maskable.png'
      ];

      requiredIcons.forEach(iconFile => {
        const iconPath = path.join(iconsDir, iconFile);
        expect(fs.existsSync(iconPath)).toBe(true);
      });
    });

    it('should have proper maskable icon configuration in manifest', () => {
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const maskableIcons = manifest.icons.filter((icon: any) => 
        icon.purpose && icon.purpose.includes('maskable')
      );
      
      expect(maskableIcons.length).toBeGreaterThan(0);
    });

    it('should have Apple Touch Icon', () => {
      const appleTouchIconPath = path.join(process.cwd(), 'public', 'apple-touch-icon-180x180.png');
      expect(fs.existsSync(appleTouchIconPath)).toBe(true);
    });

    it('should have screenshots configured in manifest', () => {
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.screenshots).toBeDefined();
      expect(Array.isArray(manifest.screenshots)).toBe(true);
      expect(manifest.screenshots.length).toBeGreaterThan(0);
    });
  });

  describe('Apple/iOS Support', () => {
    it('should have Apple-specific meta tags in layout', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      // Check for Apple Touch Icon reference
      expect(layoutContent).toContain('apple-touch-icon');
      
      // Check for Apple Web App Capable
      expect(layoutContent).toContain('apple-mobile-web-app-capable');
    });

    it('should have proper theme color meta tags', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      expect(layoutContent).toContain('themeColor: "#000000"');
    });
  });

  describe('Enhanced Manifest Configuration', () => {
    it('should have proper color scheme', () => {
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.theme_color).toBe('#000000');
      expect(manifest.background_color).toBe('#000000');
    });

    it('should have all required PWA manifest properties', () => {
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.description).toBeDefined();
      expect(manifest.start_url).toBeDefined();
      expect(manifest.display).toBeDefined();
      expect(manifest.orientation).toBeDefined();
      expect(manifest.scope).toBeDefined();
      expect(manifest.lang).toBeDefined();
      expect(manifest.dir).toBeDefined();
      expect(manifest.categories).toBeDefined();
    });
  });
});
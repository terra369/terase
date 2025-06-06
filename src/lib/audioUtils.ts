/**
 * iOS Safari specific audio utilities
 */

import { logAudioDebug, getAudioElementDebugInfo } from './audioDebug';
import { DeviceDetection } from './deviceDetection';

// iOS Safari detection - deprecated, use DeviceDetection.isIOSSafari()
export function isIOSSafari(): boolean {
  return DeviceDetection.isIOSSafari();
}

// Check if device is iOS - deprecated, use DeviceDetection.isIOS()
export function isIOS(): boolean {
  return DeviceDetection.isIOS();
}

// Create and configure audio element with iOS-specific attributes
export function createIOSAudioElement(src?: string): HTMLAudioElement {
  const audio = new Audio();
  
  // Essential iOS attributes
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('webkit-playsinline', 'true');
  audio.setAttribute('x-webkit-airplay', 'allow');
  
  // Disable controls to prevent UI issues
  audio.controls = false;
  
  // Set initial volume
  audio.volume = 1.0;
  
  // Don't set preload initially for iOS
  // Don't set src initially - will be set later
  
  // Apply muted state from store if available
  if (typeof window !== 'undefined') {
    import('@/stores/useAudioStore').then(({ useAudioStore }) => {
      const { isMuted } = useAudioStore.getState();
      audio.muted = isMuted;
    });
  }
  
  return audio;
}

// Preload audio with iOS-specific handling
export async function preloadAudioForIOS(audio: HTMLAudioElement): Promise<void> {
  // Ensure src is valid before attempting to preload
  if (!audio.src || audio.src === '' || audio.src === 'about:blank') {
    throw new Error('Cannot preload audio without valid src');
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Audio preload timeout'));
    }, 10000); // Longer timeout for iOS
    
    const handleCanPlay = () => {
      clearTimeout(timeout);
      cleanup();
      resolve();
    };
    
    const handleError = (e: Event) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(`Audio preload error: ${(e as ErrorEvent).message || 'Unknown error'}`));
    };
    
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
    
    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('canplay', handleCanPlay); // Fallback
    audio.addEventListener('error', handleError);
    
    // Trigger load
    audio.load();
  });
}

// Play audio with iOS-specific retry logic
export async function playAudioWithIOSFallback(
  audio: HTMLAudioElement, 
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error | null = null;
  
  logAudioDebug({
    audioElement: getAudioElementDebugInfo(audio),
    error: 'Starting iOS audio playback'
  });
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wait between retries
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
      
      // Ensure audio is loaded
      if (audio.readyState < 3) {
        logAudioDebug({ error: `Attempt ${attempt + 1}: Audio not ready, preloading...` });
        await preloadAudioForIOS(audio);
      }
      
      // Try to play
      logAudioDebug({ error: `Attempt ${attempt + 1}: Calling play()` });
      await audio.play();
      
      logAudioDebug({
        audioElement: getAudioElementDebugInfo(audio),
        error: 'Play successful!'
      });
      
      return; // Success!
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`Audio play attempt ${attempt + 1} failed:`, error);
      
      logAudioDebug({
        audioElement: getAudioElementDebugInfo(audio),
        error: `Attempt ${attempt + 1} failed: ${lastError.message}`
      });
      
      // On iOS, sometimes resetting src helps
      if (DeviceDetection.isIOS() && attempt < maxRetries - 1) {
        logAudioDebug({ error: 'Resetting audio src for retry...' });
        const currentSrc = audio.src;
        audio.src = '';
        audio.load();
        await new Promise(resolve => setTimeout(resolve, 50));
        audio.src = currentSrc;
      }
    }
  }
  
  logAudioDebug({
    error: `All ${maxRetries} attempts failed: ${lastError?.message}`
  });
  
  throw lastError || new Error('Failed to play audio after retries');
}

// Silent audio data URL for unlock
export const SILENT_AUDIO_DATA_URL = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAA=';
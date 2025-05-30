/**
 * iOS Safari specific audio utilities
 */

import { logAudioDebug, getAudioElementDebugInfo } from './audioDebug';

// iOS Safari detection
export function isIOSSafari(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return isIOS && isSafari;
}

// Check if device is iOS
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

// Create and configure audio element with iOS-specific attributes
export function createIOSAudioElement(src?: string): HTMLAudioElement {
  const audio = new Audio();
  
  // Essential iOS attributes
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('webkit-playsinline', 'true');
  audio.setAttribute('x-webkit-airplay', 'allow');
  
  // Set preload strategy
  audio.preload = 'auto';
  
  // Disable controls to prevent UI issues
  audio.controls = false;
  
  // Apply muted state from store if available
  if (typeof window !== 'undefined') {
    import('@/stores/useAudioStore').then(({ useAudioStore }) => {
      const { isMuted } = useAudioStore.getState();
      audio.muted = isMuted;
    });
  }
  
  if (src) {
    audio.src = src;
  }
  
  return audio;
}

// Preload audio with iOS-specific handling
export async function preloadAudioForIOS(audio: HTMLAudioElement): Promise<void> {
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
      if (isIOS() && attempt < maxRetries - 1) {
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

// Unlock audio playback on iOS
export async function unlockIOSAudio(): Promise<boolean> {
  try {
    const audio = createIOSAudioElement(SILENT_AUDIO_DATA_URL);
    audio.volume = 0.1;
    audio.muted = false;
    
    await audio.play();
    
    // Clean up
    audio.pause();
    audio.remove();
    
    return true;
  } catch (error) {
    console.error('Failed to unlock iOS audio:', error);
    return false;
  }
}
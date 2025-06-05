/**
 * 共通録音フック - React Native と Web で共用
 * Shared audio recording hook for React Native and Web platforms
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Platform-specific implementations will be injected
export interface AudioRecorderOptions {
  channelCount?: number;
  sampleRate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  maxDuration?: number;
}

export interface AudioBlob {
  data: Blob | string; // Blob for web, file path for React Native
  mimeType: string;
  size: number;
  duration?: number;
}

export interface DeviceInfo {
  isIOS: boolean;
  isIOSSafari: boolean;
  isMobile: boolean;
  supportsMediaRecorder: boolean;
  supportsWebAudio: boolean;
  requiresUserGesture: boolean;
}

export interface AudioContextManager {
  initialize(): Promise<boolean>;
  ensureRunning(): Promise<boolean>;
  handleFirstUserInteraction(): Promise<boolean>;
  getContext(): AudioContext | null;
}

export interface AudioRecorderAdapter {
  isSupported(): boolean;
  getOptimalMimeType(): string;
  getDeviceInfo(): DeviceInfo;
  createRecorder(stream: MediaStream, options: AudioRecorderOptions): MediaRecorder;
  requestPermissions(): Promise<boolean>;
  createAudioContextManager(): AudioContextManager;
}

// Default web implementation
const createWebAudioAdapter = (): AudioRecorderAdapter => ({
  isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && 
           typeof navigator.mediaDevices !== 'undefined' &&
           typeof navigator.mediaDevices.getUserMedia !== 'undefined';
  },

  getOptimalMimeType(): string {
    if (!this.isSupported()) return '';
    
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav'
    ];

    for (const mimeType of candidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return '';
  },

  getDeviceInfo(): DeviceInfo {
    const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       !(window as unknown as { MSStream?: unknown }).MSStream;
    const isIOSSafari = () => isIOS() && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    return {
      isIOS: isIOS(),
      isIOSSafari: isIOSSafari(),
      isMobile: isMobile(),
      supportsMediaRecorder: this.isSupported(),
      supportsWebAudio: typeof AudioContext !== 'undefined' || 
                        typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined',
      requiresUserGesture: isIOSSafari() || isMobile(),
    };
  },

  createRecorder(stream: MediaStream, options: AudioRecorderOptions): MediaRecorder {
    const mimeType = this.getOptimalMimeType();
    const recorderOptions = MediaRecorder.isTypeSupported(mimeType) 
      ? { mimeType }
      : {};
    
    return new MediaRecorder(stream, recorderOptions);
  },

  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  },

  createAudioContextManager(): AudioContextManager {
    let globalAudioContext: AudioContext | null = null;

    return {
      async initialize(): Promise<boolean> {
        if (typeof window === 'undefined') return false;
        
        try {
          if (globalAudioContext && globalAudioContext.state !== 'closed') {
            if (globalAudioContext.state === 'suspended') {
              await globalAudioContext.resume();
            }
            return true;
          }

          const AudioContextClass = window.AudioContext || 
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          globalAudioContext = new AudioContextClass();
          
          if (globalAudioContext.state === 'suspended') {
            await globalAudioContext.resume();
          }
          
          return true;
        } catch {
          return false;
        }
      },

      async ensureRunning(): Promise<boolean> {
        const initialized = await this.initialize();
        if (!initialized || !globalAudioContext) return false;
        
        if (globalAudioContext.state === 'suspended') {
          await globalAudioContext.resume();
          
          // iOS specific handling
          const deviceInfo = createWebAudioAdapter().getDeviceInfo();
          if (deviceInfo.isIOSSafari) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (globalAudioContext.state === 'suspended') {
              await globalAudioContext.resume();
            }
          }
        }
        
        return globalAudioContext.state === 'running';
      },

      async handleFirstUserInteraction(): Promise<boolean> {
        try {
          const initialized = await this.initialize();
          if (!initialized || !globalAudioContext) return false;
          
          const deviceInfo = createWebAudioAdapter().getDeviceInfo();
          
          // Play dummy audio to ensure browser audio permission
          const oscillator = globalAudioContext.createOscillator();
          const gainNode = globalAudioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(globalAudioContext.destination);
          
          const duration = deviceInfo.isIOSSafari ? 0.25 : 0.1;
          const volume = 0.00001;
          
          gainNode.gain.setValueAtTime(volume, globalAudioContext.currentTime);
          oscillator.frequency.setValueAtTime(440, globalAudioContext.currentTime);
          oscillator.start(globalAudioContext.currentTime);
          oscillator.stop(globalAudioContext.currentTime + duration);
          
          const waitTime = deviceInfo.isIOSSafari ? 200 : 50;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          if (deviceInfo.isIOSSafari) {
            if (globalAudioContext.state === 'suspended') {
              await globalAudioContext.resume();
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (globalAudioContext.state !== 'running') {
              console.warn('AudioContext is not running after initialization on iOS Safari');
              return false;
            }
          }
          
          return true;
        } catch {
          return false;
        }
      },

      getContext(): AudioContext | null {
        return globalAudioContext;
      }
    };
  }
});

export interface UseAudioOptions extends AudioRecorderOptions {
  adapter?: AudioRecorderAdapter;
}

export interface UseAudioResult {
  recording: boolean;
  error: string | null;
  mimeType: string;
  start: () => Promise<void>;
  stop: () => Promise<AudioBlob>;
  isSupported: boolean;
}

/**
 * 共通録音フック
 * Web と React Native で使用可能な統一インターフェース
 */
export function useAudio(options: UseAudioOptions = {}): UseAudioResult {
  const {
    channelCount = 1,
    sampleRate = 16000,
    echoCancellation = true,
    noiseSuppression = true,
    adapter = createWebAudioAdapter()
  } = options;

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');

  const chunks = useRef<BlobPart[]>([]);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContextManager = useRef<AudioContextManager>(adapter.createAudioContextManager());

  // Initialize mime type on client side
  useEffect(() => {
    if (adapter.isSupported()) {
      setMimeType(adapter.getOptimalMimeType());
    }
  }, [adapter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder.current?.state === 'recording') {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  const start = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      
      if (!adapter.isSupported()) {
        throw new Error('Audio recording is not supported on this device');
      }

      // Initialize audio context for user interaction
      await audioContextManager.current.handleFirstUserInteraction();
      await audioContextManager.current.ensureRunning();
      
      const deviceInfo = adapter.getDeviceInfo();
      
      // iOS specific delay
      if (deviceInfo.isIOSSafari) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount,
          sampleRate,
          echoCancellation,
          noiseSuppression
        }
      });

      // Create recorder
      mediaRecorder.current = adapter.createRecorder(stream, {
        channelCount,
        sampleRate,
        echoCancellation,
        noiseSuppression
      });

      // Setup event handlers
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('録音中にエラーが発生しました');
      };

      // Start recording
      mediaRecorder.current.start(1000);
      setRecording(true);

      // iOS Safari debugging
      if (deviceInfo.isIOSSafari) {
        console.log('Recording started on iOS Safari, MediaRecorder state:', mediaRecorder.current.state);
        console.log('Stream active:', stream.active);
        console.log('Stream tracks:', stream.getTracks().map(t => ({ 
          kind: t.kind, 
          enabled: t.enabled, 
          muted: t.muted 
        })));
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '録音の開始に失敗しました';
      setError(errorMessage);
      console.error('Recording start error:', err);
      throw err;
    }
  }, [adapter, channelCount, sampleRate, echoCancellation, noiseSuppression]);

  const stop = useCallback(async (): Promise<AudioBlob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') {
        reject(new Error('MediaRecorder is not active'));
        return;
      }

      const currentMimeType = mimeType;

      mediaRecorder.current.addEventListener('stop', () => {
        setRecording(false);
        
        if (chunks.current.length === 0) {
          reject(new Error('No audio data recorded'));
          return;
        }

        const blob = new Blob(chunks.current, { type: currentMimeType });
        chunks.current = [];

        // Stop all tracks to release microphone
        if (mediaRecorder.current?.stream) {
          mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
        }

        resolve({
          data: blob,
          mimeType: currentMimeType,
          size: blob.size
        });
      });

      mediaRecorder.current.addEventListener('error', (event) => {
        console.error('MediaRecorder stop error:', event);
        reject(new Error('録音の停止に失敗しました'));
      });

      try {
        mediaRecorder.current.stop();
      } catch (err) {
        reject(err);
      }
    });
  }, [mimeType]);

  return {
    recording,
    error,
    mimeType,
    start,
    stop,
    isSupported: adapter.isSupported()
  };
}

// Export the web adapter for backward compatibility
export { createWebAudioAdapter };
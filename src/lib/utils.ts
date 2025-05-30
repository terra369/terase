import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const logger = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  }
};

export interface AudioError {
  type: 'permission' | 'network' | 'playback' | 'unknown';
  message: string;
  originalError?: Error;
}

export function createAudioError(error: Error | string, type: AudioError['type'] = 'unknown'): AudioError {
  const message = typeof error === 'string' ? error : error.message;
  const originalError = typeof error === 'string' ? undefined : error;
  
  return {
    type,
    message,
    originalError
  };
}

export function handleAudioError(error: Error | string, context?: string): AudioError {
  const errorString = typeof error === 'string' ? error : error.message;
  const originalError = typeof error === 'string' ? undefined : error;
  
  let type: AudioError['type'] = 'unknown';
  let message = errorString;
  
  // Categorize common audio errors
  if (errorString.includes('NotAllowedError') || errorString.includes('permission')) {
    type = 'permission';
    message = '音声の再生が許可されていません。ボタンをタップして音声を有効にしてください。';
  } else if (errorString.includes('NetworkError') || errorString.includes('fetch')) {
    type = 'network';
    message = 'ネットワークエラーにより音声を読み込めませんでした。';
  } else if (errorString.includes('play') || errorString.includes('decode')) {
    type = 'playback';
    message = '音声の再生に失敗しました。';
  }
  
  const audioError = {
    type,
    message,
    originalError
  };
  
  logger.error(`Audio error${context ? ` in ${context}` : ''}:`, audioError);
  
  return audioError;
}

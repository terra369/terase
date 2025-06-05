export type ErrorType = 
  | 'recording' 
  | 'transcription' 
  | 'ai' 
  | 'network' 
  | 'permission' 
  | 'validation' 
  | 'tts' 
  | 'auth'
  | 'unknown';

export interface TerazeError {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  originalError?: unknown;
}

export function createError(type: ErrorType, error: unknown, userMessage?: string): TerazeError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return {
    type,
    message: errorMessage,
    userMessage: userMessage || getDefaultUserMessage(type, errorMessage),
    retryable: isRetryable(type, errorMessage),
    originalError: error
  };
}

function getDefaultUserMessage(type: ErrorType, errorMessage: string): string {
  switch (type) {
    case 'recording':
      return 'マイクの録音に失敗しました。ブラウザの設定を確認してください。';
    case 'transcription':
      return `文字起こしエラー: ${errorMessage}`;
    case 'ai':
      return `AI応答エラー: ${errorMessage}`;
    case 'network':
      return 'ネットワークエラーが発生しました。接続を確認してください。';
    case 'permission':
      return 'マイクへのアクセス許可が必要です。ブラウザの設定を確認してください。';
    case 'validation':
      return '入力データが無効です。';
    case 'tts':
      return '音声の再生に失敗しました。';
    case 'auth':
      return '認証エラーが発生しました。再度ログインしてください。';
    default:
      return 'エラーが発生しました。';
  }
}

function isRetryable(type: ErrorType, errorMessage: string): boolean {
  switch (type) {
    case 'network':
    case 'transcription':
    case 'ai':
    case 'tts':
      return true;
    case 'permission':
    case 'validation':
    case 'auth':
      return false;
    case 'recording':
      // Some recording errors are retryable
      return !errorMessage.includes('permission') && !errorMessage.includes('NotAllowed');
    default:
      return false;
  }
}

export class ErrorHandler {
  private error: TerazeError;

  constructor(type: ErrorType, originalError: unknown, userMessage?: string) {
    this.error = createError(type, originalError, userMessage);
  }

  static fromUnknown(error: unknown, fallbackType: ErrorType = 'unknown'): ErrorHandler {
    if (error instanceof Error) {
      // Detect error type from message patterns
      const type = detectErrorType(error.message);
      return new ErrorHandler(type, error);
    }
    
    return new ErrorHandler(fallbackType, error);
  }

  getUserMessage(): string {
    return this.error.userMessage;
  }

  isRetryable(): boolean {
    return this.error.retryable;
  }

  getType(): ErrorType {
    return this.error.type;
  }

  log(): void {
    console.error(`[${this.error.type.toUpperCase()}]`, this.error.message, this.error.originalError);
  }

  toJSON(): TerazeError {
    return this.error;
  }
}

function detectErrorType(errorMessage: string): ErrorType {
  const message = errorMessage.toLowerCase();
  
  if (message.includes('permission') || message.includes('notallowed') || message.includes('denied')) {
    return 'permission';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'network';
  }
  if (message.includes('transcrib') || message.includes('文字起こし')) {
    return 'transcription';
  }
  if (message.includes('ai') || message.includes('gpt') || message.includes('応答')) {
    return 'ai';
  }
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('認証')) {
    return 'auth';
  }
  if (message.includes('record') || message.includes('microphone') || message.includes('録音')) {
    return 'recording';
  }
  if (message.includes('tts') || message.includes('speak') || message.includes('音声') || message.includes('再生')) {
    return 'tts';
  }
  
  return 'unknown';
}

// Utility functions for common error scenarios
export const ErrorUtils = {
  transcription: (error: unknown) => new ErrorHandler('transcription', error),
  ai: (error: unknown) => new ErrorHandler('ai', error),
  recording: (error: unknown) => new ErrorHandler('recording', error),
  network: (error: unknown) => new ErrorHandler('network', error),
  permission: (error: unknown) => new ErrorHandler('permission', error),
  tts: (error: unknown) => new ErrorHandler('tts', error),
  auth: (error: unknown) => new ErrorHandler('auth', error),
  validation: (error: unknown) => new ErrorHandler('validation', error),
} as const;
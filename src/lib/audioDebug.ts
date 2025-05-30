/**
 * Audio debugging utilities for iOS troubleshooting
 */

interface AudioDebugInfo {
  timestamp: string;
  userAgent: string;
  isIOS: boolean;
  isSafari: boolean;
  audioContextState?: string;
  audioElement?: {
    readyState: number;
    paused: boolean;
    currentTime: number;
    duration: number;
    error: string | null;
    src: string;
    networkState: number;
  };
  error?: string;
}

const debugLogs: AudioDebugInfo[] = [];

export function logAudioDebug(info: Partial<AudioDebugInfo>) {
  const fullInfo: AudioDebugInfo = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    ...info
  };
  
  debugLogs.push(fullInfo);
  console.log('[Audio Debug]', fullInfo);
  
  // Keep only last 50 logs
  if (debugLogs.length > 50) {
    debugLogs.shift();
  }
}

export function getAudioDebugLogs(): AudioDebugInfo[] {
  return [...debugLogs];
}

export function clearAudioDebugLogs() {
  debugLogs.length = 0;
}

// Helper to get audio element debug info
export function getAudioElementDebugInfo(audio: HTMLAudioElement) {
  return {
    readyState: audio.readyState,
    paused: audio.paused,
    currentTime: audio.currentTime,
    duration: audio.duration,
    error: audio.error?.message || null,
    src: audio.src,
    networkState: audio.networkState
  };
}

// Debug panel component
export function AudioDebugPanel() {
  if (typeof window === 'undefined') return null;
  
  const logs = getAudioDebugLogs();
  
  if (logs.length === 0) return null;
  
  return `
    <div style="position: fixed; bottom: 0; right: 0; width: 400px; max-height: 300px; overflow-y: auto; background: rgba(0,0,0,0.9); color: white; padding: 10px; font-size: 10px; font-family: monospace; z-index: 9999;">
      <h4>Audio Debug Logs (${logs.length})</h4>
      ${logs.map((log) => `
        <div style="margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">
          <div>${log.timestamp}</div>
          <div>iOS: ${log.isIOS}, Safari: ${log.isSafari}</div>
          ${log.audioContextState ? `<div>Context: ${log.audioContextState}</div>` : ''}
          ${log.audioElement ? `
            <div>Audio: ready=${log.audioElement.readyState}, paused=${log.audioElement.paused}</div>
            <div>Time: ${log.audioElement.currentTime}/${log.audioElement.duration}</div>
            ${log.audioElement.error ? `<div style="color: red;">Error: ${log.audioElement.error}</div>` : ''}
          ` : ''}
          ${log.error ? `<div style="color: red;">Error: ${log.error}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
import { useAudio } from '../../../core/hooks/useAudio'
import { DeviceDetection } from '@/lib/deviceDetection'

/**
 * Legacy recording hook - adapter for backward compatibility
 * New code should use useAudio from core/hooks instead
 * 
 * @deprecated Use useAudio from @/core/hooks/useAudio instead
 */
export function useRecorder() {
  const { isRecording, error, startRecording, stopRecording } = useAudio()
  
  // Get current MIME type for compatibility
  const mimeType = DeviceDetection.getOptimalMimeType()
  
  // Adapter functions to match legacy interface
  const start = async () => {
    await startRecording()
  }
  
  const stop = async (): Promise<Blob> => {
    return await stopRecording()
  }
  
  return { 
    recording: isRecording, 
    start, 
    stop, 
    error, 
    mimeType 
  }
}
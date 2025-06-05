import { useAudio } from '@core/hooks/useAudio'
import { ErrorUtils } from '@/lib/errorHandling'

export function useRecorder() {
  const { recording, error: audioError, mimeType, start: audioStart, stop: audioStop } = useAudio()
  
  async function start() {
    try {
      await audioStart()
    } catch (err) {
      const errorHandler = ErrorUtils.recording(err)
      errorHandler.log()
      throw err
    }
  }

  async function stop(): Promise<Blob> {
    try {
      const audioBlob = await audioStop()
      
      // Convert AudioBlob to Blob for backward compatibility
      if (audioBlob.data instanceof Blob) {
        return audioBlob.data
      } else {
        // Handle React Native case (file path)
        throw new Error('File path handling not implemented for web')
      }
    } catch (err) {
      const errorHandler = ErrorUtils.recording(err)
      errorHandler.log()
      throw err
    }
  }
  
  return { recording, start, stop, error: audioError, mimeType }
}
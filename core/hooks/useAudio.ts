import { useEffect, useRef, useState, useCallback } from 'react'
import { handleFirstUserInteraction, ensureAudioContextRunning } from '@/lib/audioContext'
import { DeviceDetection } from '@/lib/deviceDetection'
import { ErrorUtils } from '@/lib/errorHandling'

/**
 * Common audio recording interface for web and mobile platforms
 * Provides unified API for recording audio with platform-specific optimizations
 */
export interface UseAudioResult {
  /**
   * Whether recording is currently active
   */
  isRecording: boolean
  
  /**
   * Current error message if any
   */
  error: string | null
  
  /**
   * Start recording audio
   * @throws Error if recording fails to start
   */
  startRecording: () => Promise<void>
  
  /**
   * Stop recording and return the recorded audio
   * @returns Blob containing the recorded audio
   * @throws Error if no audio data was recorded
   */
  stopRecording: () => Promise<Blob>
  
  /**
   * Get current audio data without stopping recording
   * @returns Blob containing current audio data or null if no data
   */
  getAudioData: () => Blob | null
}

export function useAudio(): UseAudioResult {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const chunks = useRef<BlobPart[]>([])
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const mimeType = useRef<string>('audio/webm')
  
  // Initialize mime type on client side only
  useEffect(() => {
    mimeType.current = DeviceDetection.getOptimalMimeType()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder.current?.state === 'recording') {
        mediaRecorder.current.stop()
        // Release microphone
        if (mediaRecorder.current.stream) {
          mediaRecorder.current.stream.getTracks().forEach(track => track.stop())
        }
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      
      // Check MediaRecorder support
      if (!('MediaRecorder' in window)) {
        throw new Error('MediaRecorder is not supported in this browser')
      }
      
      // Check getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser')
      }
      
      // Initialize audio context on first user interaction
      await handleFirstUserInteraction()
      await ensureAudioContextRunning()
      
      // Get device info for platform-specific handling
      const deviceInfo = DeviceDetection.getDeviceInfo()
      
      // iOS Safari requires a delay before starting recording
      if (deviceInfo.isIOSSafari) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      // Get optimal MIME type for current platform
      mimeType.current = DeviceDetection.getOptimalMimeType()
      const options = MediaRecorder.isTypeSupported(mimeType.current) 
        ? { mimeType: mimeType.current }
        : {}
      
      // Create MediaRecorder instance
      mediaRecorder.current = new MediaRecorder(stream, options)
      
      // Clear previous chunks
      chunks.current = []
      
      // Handle data available events
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data)
        }
      }
      
      // Handle errors
      mediaRecorder.current.onerror = (event) => {
        const errorHandler = ErrorUtils.recording(event)
        errorHandler.log()
        setError(errorHandler.getUserMessage())
        setIsRecording(false)
      }
      
      // Start recording in 1-second chunks
      mediaRecorder.current.start(1000)
      setIsRecording(true)
      
      // Log for iOS Safari debugging
      if (deviceInfo.isIOSSafari) {
        console.log('Recording started on iOS Safari, MediaRecorder state:', mediaRecorder.current.state)
        console.log('Stream active:', stream.active)
        console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })))
      }
      
    } catch (err) {
      const errorHandler = ErrorUtils.recording(err)
      errorHandler.log()
      setError(errorHandler.getUserMessage())
      setIsRecording(false)
      throw err
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') {
        reject(new Error('MediaRecorder is not active'))
        return
      }
      
      // Add event listeners for stop
      mediaRecorder.current.addEventListener('stop', () => {
        setIsRecording(false)
        
        if (chunks.current.length === 0) {
          reject(new Error('No audio data recorded'))
          return
        }
        
        // Create blob with the same mime type used for recording
        const blob = new Blob(chunks.current, { type: mimeType.current })
        
        // Clear chunks after creating blob
        chunks.current = []
        
        // Stop all tracks to release the microphone
        if (mediaRecorder.current?.stream) {
          mediaRecorder.current.stream.getTracks().forEach(track => track.stop())
        }
        
        resolve(blob)
      })
      
      mediaRecorder.current.addEventListener('error', (event) => {
        console.error('MediaRecorder stop error:', event)
        setIsRecording(false)
        reject(new Error('Failed to stop recording'))
      })
      
      try {
        mediaRecorder.current.stop()
      } catch (err) {
        setIsRecording(false)
        reject(err)
      }
    })
  }, [])

  const getAudioData = useCallback((): Blob | null => {
    if (chunks.current.length === 0) {
      return null
    }
    
    // Return current audio data without stopping recording
    return new Blob(chunks.current, { type: mimeType.current })
  }, [])

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
    getAudioData
  }
}
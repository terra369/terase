import { useEffect, useRef, useState } from 'react'

// Get the best supported MIME type for recording
function getSupportedMimeType(): string {
  // Return default for SSR
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    return 'audio/webm'
  }
  
  const types = [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
    'audio/webm'
  ]
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  
  // Fallback to default
  return 'audio/webm'
}

export function useRecorder() {
  const [recording, setRec] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const mediaRec = useRef<MediaRecorder | null>(null)
  const mimeType = useRef<string>('audio/webm')
  
  // Initialize mime type on client side only
  useEffect(() => {
    mimeType.current = getSupportedMimeType()
  }, [])

  useEffect(() => {
    return () => {
      if (mediaRec.current?.state === 'recording') {
        mediaRec.current.stop()
      }
    }
  }, [])

  async function start() {
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
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      const options = MediaRecorder.isTypeSupported(mimeType.current) 
        ? { mimeType: mimeType.current }
        : {}
      
      mediaRec.current = new MediaRecorder(stream, options)
      
      mediaRec.current.ondataavailable = e => {
        if (e.data.size > 0) {
          chunks.current.push(e.data)
        }
      }
      
      mediaRec.current.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setError('録音中にエラーが発生しました')
      }
      
      mediaRec.current.start(1000) // Record in 1-second chunks
      setRec(true)
      
    } catch (err) {
      console.error('Recording start error:', err)
      const errorMessage = err instanceof Error ? err.message : 'マイクへのアクセスに失敗しました'
      setError(errorMessage)
      throw err
    }
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!mediaRec.current || mediaRec.current.state === 'inactive') {
        reject(new Error('MediaRecorder is not active'))
        return
      }
      
      mediaRec.current.addEventListener('stop', () => {
        setRec(false)
        
        if (chunks.current.length === 0) {
          reject(new Error('No audio data recorded'))
          return
        }
        
        // Use the same mime type that was used for recording
        const blob = new Blob(chunks.current, { type: mimeType.current })
        chunks.current = []
        
        // Stop all tracks to release the microphone
        if (mediaRec.current?.stream) {
          mediaRec.current.stream.getTracks().forEach(track => track.stop())
        }
        
        resolve(blob)
      })
      
      mediaRec.current.addEventListener('error', (event) => {
        console.error('MediaRecorder stop error:', event)
        reject(new Error('録音の停止に失敗しました'))
      })
      
      try {
        mediaRec.current.stop()
      } catch (err) {
        reject(err)
      }
    })
  }
  
  return { recording, start, stop, error, mimeType: mimeType.current }
}
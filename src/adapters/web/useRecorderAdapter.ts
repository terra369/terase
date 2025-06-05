/**
 * Web adapter for core AudioRecorder
 * Bridges React hooks with core recording functionality
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AudioRecorder } from '@/core/audio/recorder'
import { ErrorHandler } from '@/core/utils/errorHandling'

export function useRecorderAdapter() {
  const [recording, setRec] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<AudioRecorder | null>(null)
  const [mimeType, setMimeType] = useState<string>('')
  
  // Initialize recorder on mount
  useEffect(() => {
    async function initializeRecorder() {
      try {
        const recorder = new AudioRecorder({
          onError: (error) => {
            const errorHandler = ErrorHandler.fromUnknown(error, 'recording')
            errorHandler.log()
            setError(errorHandler.getUserMessage())
            setRec(false)
          }
        })
        
        await recorder.initialize()
        recorderRef.current = recorder
        setMimeType(recorder.getState().mimeType)
      } catch (err) {
        const errorHandler = ErrorHandler.fromUnknown(err, 'recording')
        errorHandler.log()
        setError(errorHandler.getUserMessage())
      }
    }

    initializeRecorder()

    return () => {
      if (recorderRef.current) {
        recorderRef.current.dispose()
      }
    }
  }, [])

  const start = useCallback(async () => {
    if (!recorderRef.current) {
      setError('Recorder not initialized')
      return
    }

    try {
      setError(null)
      await recorderRef.current.start()
      setRec(true)
    } catch (err) {
      const errorHandler = ErrorHandler.fromUnknown(err, 'recording')
      errorHandler.log()
      setError(errorHandler.getUserMessage())
      throw err
    }
  }, [])

  const stop = useCallback(async (): Promise<Blob> => {
    if (!recorderRef.current) {
      throw new Error('Recorder not initialized')
    }

    try {
      const blob = await recorderRef.current.stop()
      setRec(false)
      return blob
    } catch (err) {
      setRec(false)
      const errorHandler = ErrorHandler.fromUnknown(err, 'recording')
      errorHandler.log()
      setError(errorHandler.getUserMessage())
      throw err
    }
  }, [])
  
  return { 
    recording, 
    start, 
    stop, 
    error, 
    mimeType
  }
}
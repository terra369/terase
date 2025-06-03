import { useEffect, useRef, useState } from 'react'
import { handleFirstUserInteraction, ensureAudioContextRunning } from '@/lib/audioContext'
import { DeviceDetection } from '@/lib/deviceDetection'
import { ErrorHandler, ErrorUtils } from '@/lib/errorHandling'

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
      
      // 初回録音時にAudioContextを初期化（ユーザーインタラクション時）
      await handleFirstUserInteraction()
      await ensureAudioContextRunning()
      
      // デバイス検出
      const deviceInfo = DeviceDetection.getDeviceInfo()
      
      // iOSの場合は少し待機してから録音開始
      if (deviceInfo.isIOSSafari) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      // 最適なMIMEタイプを取得
      mimeType.current = DeviceDetection.getOptimalMimeType()
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
        const errorHandler = ErrorUtils.recording(event)
        errorHandler.log()
        setError(errorHandler.getUserMessage())
      }
      
      mediaRec.current.start(1000) // Record in 1-second chunks
      setRec(true)
      
      // iOS Safariの場合、録音開始を確認
      if (deviceInfo.isIOSSafari) {
        console.log('Recording started on iOS Safari, MediaRecorder state:', mediaRec.current.state)
        console.log('Stream active:', stream.active)
        console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })))
      }
      
    } catch (err) {
      const errorHandler = ErrorUtils.recording(err)
      errorHandler.log()
      setError(errorHandler.getUserMessage())
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
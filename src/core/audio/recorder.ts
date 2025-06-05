/**
 * Core audio recording functionality
 * Shared between Web and Mobile platforms
 */

import { DeviceDetection } from '../utils/deviceDetection'
import { ErrorUtils } from '../utils/errorHandling'

export interface RecorderOptions {
  channelCount?: number
  sampleRate?: number
  echoCancellation?: boolean
  noiseSuppression?: boolean
  onDataAvailable?: (chunk: BlobPart) => void
  onError?: (error: Error) => void
}

export interface RecorderState {
  isRecording: boolean
  mimeType: string
  chunks: BlobPart[]
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: BlobPart[] = []
  private mimeType: string = ''
  private options: RecorderOptions

  constructor(options: RecorderOptions = {}) {
    this.options = {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      ...options
    }
  }

  async initialize(): Promise<void> {
    // Check browser support
    if (!this.isSupported()) {
      throw new Error('MediaRecorder is not supported in this browser')
    }

    // Get optimal MIME type for the device
    this.mimeType = DeviceDetection.getOptimalMimeType()
    if (!this.mimeType) {
      throw new Error('No supported audio format found')
    }
  }

  async start(): Promise<void> {
    if (this.isRecording()) {
      throw new Error('Recording is already in progress')
    }

    try {
      // Initialize audio context for iOS Safari compatibility
      await this.initializeAudioContext()

      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.options.channelCount,
          sampleRate: this.options.sampleRate,
          echoCancellation: this.options.echoCancellation,
          noiseSuppression: this.options.noiseSuppression
        }
      })

      // Device-specific delays
      const deviceInfo = DeviceDetection.getDeviceInfo()
      if (deviceInfo.isIOSSafari) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      // Create MediaRecorder
      const options = MediaRecorder.isTypeSupported(this.mimeType)
        ? { mimeType: this.mimeType }
        : {}

      this.mediaRecorder = new MediaRecorder(this.stream, options)

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data)
          this.options.onDataAvailable?.(event.data)
        }
      }

      this.mediaRecorder.onerror = (event) => {
        const error = new Error('MediaRecorder error')
        this.options.onError?.(error)
      }

      // Start recording
      this.mediaRecorder.start(1000) // Record in 1-second chunks

    } catch (error) {
      this.cleanup()
      const errorHandler = ErrorUtils.recording(error)
      errorHandler.log()
      throw error
    }
  }

  async stop(): Promise<Blob> {
    if (!this.isRecording()) {
      throw new Error('No recording in progress')
    }

    return new Promise((resolve, reject) => {
      const mediaRecorder = this.mediaRecorder!

      mediaRecorder.addEventListener('stop', () => {
        if (this.chunks.length === 0) {
          reject(new Error('No audio data recorded'))
          return
        }

        const blob = new Blob(this.chunks, { type: this.mimeType })
        this.cleanup()
        resolve(blob)
      })

      mediaRecorder.addEventListener('error', (event) => {
        this.cleanup()
        reject(new Error('Recording stop failed'))
      })

      try {
        mediaRecorder.stop()
      } catch (error) {
        this.cleanup()
        reject(error)
      }
    })
  }

  pause(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause()
    }
  }

  resume(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume()
    }
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused'
  }

  getState(): RecorderState {
    return {
      isRecording: this.isRecording(),
      mimeType: this.mimeType,
      chunks: [...this.chunks]
    }
  }

  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' &&
           typeof navigator !== 'undefined' &&
           !!navigator.mediaDevices?.getUserMedia
  }

  private isSupported(): boolean {
    return AudioRecorder.isSupported()
  }

  private async initializeAudioContext(): Promise<void> {
    if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
      return
    }

    try {
      const AudioContextClass = AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass()
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
    } catch (error) {
      console.warn('Failed to initialize audio context:', error)
    }
  }

  private cleanup(): void {
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    // Reset state
    this.mediaRecorder = null
    this.chunks = []
  }

  dispose(): void {
    if (this.isRecording()) {
      this.mediaRecorder?.stop()
    }
    this.cleanup()
  }
}
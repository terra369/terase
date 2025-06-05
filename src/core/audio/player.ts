/**
 * Core audio playback functionality  
 * Shared between Web and Mobile platforms
 */

import { DeviceDetection } from '../utils/deviceDetection'
import { ErrorUtils } from '../utils/errorHandling'

export interface AudioPlayerOptions {
  autoplay?: boolean
  loop?: boolean
  volume?: number
  onProgress?: (progress: number) => void
  onEnd?: () => void
  onError?: (error: Error) => void
}

export interface AudioPlayerState {
  isPlaying: boolean
  isPaused: boolean
  currentTime: number
  duration: number
  volume: number
}

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null
  private currentBlobUrl: string | null = null
  private progressInterval: NodeJS.Timeout | null = null
  private options: AudioPlayerOptions

  constructor(options: AudioPlayerOptions = {}) {
    this.options = {
      autoplay: false,
      loop: false,
      volume: 1.0,
      ...options
    }
  }

  async initialize(): Promise<void> {
    if (this.audio) {
      this.cleanup()
    }

    // Create audio element with device-specific optimizations
    this.audio = this.createAudioElement()
    this.setupEventListeners()
  }

  async playAudio(audioBlob: Blob): Promise<void> {
    if (!this.audio) {
      await this.initialize()
    }

    try {
      // Cleanup previous audio
      this.cleanup(false)

      // Create new blob URL
      this.currentBlobUrl = URL.createObjectURL(audioBlob)
      this.audio!.src = this.currentBlobUrl

      // Device-specific optimizations
      const deviceInfo = DeviceDetection.getDeviceInfo()
      if (deviceInfo.isIOS) {
        this.audio!.preload = 'auto'
        await this.loadAudioForIOS()
      } else {
        this.audio!.load()
        await this.waitForCanPlay()
      }

      // Start playback
      await this.audio!.play()

      // Start progress tracking
      this.startProgressTracking()

    } catch (error) {
      const errorHandler = ErrorUtils.tts(error)
      errorHandler.log()
      this.options.onError?.(error as Error)
      throw error
    }
  }

  async playFromUrl(url: string): Promise<void> {
    if (!this.audio) {
      await this.initialize()
    }

    try {
      this.cleanup(false)
      this.audio!.src = url

      const deviceInfo = DeviceDetection.getDeviceInfo()
      if (deviceInfo.isIOS) {
        await this.loadAudioForIOS()
      } else {
        this.audio!.load()
        await this.waitForCanPlay()
      }

      await this.audio!.play()
      this.startProgressTracking()

    } catch (error) {
      const errorHandler = ErrorUtils.tts(error)
      errorHandler.log()
      this.options.onError?.(error as Error)
      throw error
    }
  }

  pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause()
      this.stopProgressTracking()
    }
  }

  resume(): void {
    if (this.audio && this.audio.paused) {
      this.audio.play().catch(error => {
        this.options.onError?.(error)
      })
      this.startProgressTracking()
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
      this.stopProgressTracking()
    }
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume))
      this.options.volume = this.audio.volume
    }
  }

  setMuted(muted: boolean): void {
    if (this.audio) {
      this.audio.muted = muted
    }
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, time))
    }
  }

  getState(): AudioPlayerState {
    if (!this.audio) {
      return {
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        duration: 0,
        volume: this.options.volume || 1.0
      }
    }

    return {
      isPlaying: !this.audio.paused && !this.audio.ended,
      isPaused: this.audio.paused,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration || 0,
      volume: this.audio.volume
    }
  }

  static async unlockAudioPlayback(): Promise<boolean> {
    try {
      // Try to play silent audio to unlock
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAA=')
      silentAudio.volume = 0.01
      
      await silentAudio.play()
      await new Promise(resolve => setTimeout(resolve, 100))
      silentAudio.pause()
      
      return true
    } catch (error) {
      console.warn('Audio unlock failed:', error)
      return false
    }
  }

  private createAudioElement(): HTMLAudioElement {
    const audio = new Audio()
    
    // Device-specific configurations
    const deviceInfo = DeviceDetection.getDeviceInfo()
    
    if (deviceInfo.isIOS) {
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('webkit-playsinline', 'true')
    }

    // Apply options
    audio.volume = this.options.volume || 1.0
    audio.loop = this.options.loop || false

    return audio
  }

  private setupEventListeners(): void {
    if (!this.audio) return

    this.audio.addEventListener('ended', () => {
      this.stopProgressTracking()
      this.options.onEnd?.()
    })

    this.audio.addEventListener('error', (event) => {
      this.stopProgressTracking()
      const error = new Error('Audio playback error')
      this.options.onError?.(error)
    })

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.options.autoplay) {
        this.audio!.play().catch(error => {
          this.options.onError?.(error)
        })
      }
    })
  }

  private async loadAudioForIOS(): Promise<void> {
    if (!this.audio) return

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio load timeout'))
      }, 5000)

      const handleCanPlay = () => {
        clearTimeout(timeout)
        this.audio!.removeEventListener('canplaythrough', handleCanPlay)
        this.audio!.removeEventListener('error', handleError)
        resolve()
      }

      const handleError = () => {
        clearTimeout(timeout)
        this.audio!.removeEventListener('canplaythrough', handleCanPlay)
        this.audio!.removeEventListener('error', handleError)
        reject(new Error('Audio load error'))
      }

      this.audio!.addEventListener('canplaythrough', handleCanPlay, { once: true })
      this.audio!.addEventListener('error', handleError, { once: true })

      this.audio!.load()
    })
  }

  private async waitForCanPlay(): Promise<void> {
    if (!this.audio) return

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio load timeout'))
      }, 5000)

      const handleCanPlay = () => {
        clearTimeout(timeout)
        resolve()
      }

      const handleError = () => {
        clearTimeout(timeout)
        reject(new Error('Audio load error'))
      }

      this.audio!.addEventListener('canplaythrough', handleCanPlay, { once: true })
      this.audio!.addEventListener('error', handleError, { once: true })
    })
  }

  private startProgressTracking(): void {
    if (!this.audio || !this.options.onProgress) return

    this.progressInterval = setInterval(() => {
      if (this.audio && this.audio.duration) {
        const progress = (this.audio.currentTime / this.audio.duration) * 100
        this.options.onProgress!(progress)
      }
    }, 100)
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }

  private cleanup(includeAudio = true): void {
    this.stopProgressTracking()

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl)
      this.currentBlobUrl = null
    }

    if (includeAudio && this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
  }

  dispose(): void {
    this.cleanup(true)
  }
}
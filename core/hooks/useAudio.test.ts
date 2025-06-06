import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudio } from './useAudio'

// Mock dependencies
vi.mock('@/lib/deviceDetection', () => ({
  DeviceDetection: {
    getDeviceInfo: vi.fn(() => ({
      isIOSSafari: false,
      isMobile: false,
      requiresUserGesture: false
    })),
    getOptimalMimeType: vi.fn(() => 'audio/webm')
  }
}))

vi.mock('@/lib/audioContext', () => ({
  handleFirstUserInteraction: vi.fn(() => Promise.resolve()),
  ensureAudioContextRunning: vi.fn(() => Promise.resolve())
}))

vi.mock('@/lib/errorHandling', () => ({
  ErrorUtils: {
    recording: vi.fn((error) => ({
      log: vi.fn(),
      getUserMessage: vi.fn(() => '録音エラーが発生しました')
    }))
  }
}))

describe('useAudio', () => {
  let mockMediaRecorder: any
  let mockStream: MediaStream

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock MediaStream
    mockStream = {
      active: true,
      getTracks: vi.fn(() => [
        {
          kind: 'audio',
          enabled: true,
          muted: false,
          stop: vi.fn()
        }
      ])
    } as any

    // Mock MediaRecorder
    mockMediaRecorder = {
      state: 'inactive',
      start: vi.fn(function(this: any) {
        this.state = 'recording'
      }),
      stop: vi.fn(function(this: any) {
        this.state = 'inactive'
        // Trigger stop event
        if (this.onstop) {
          setTimeout(() => this.onstop(), 0)
        }
      }),
      addEventListener: vi.fn(function(this: any, event: string, handler: Function) {
        if (event === 'stop') {
          this.onstop = handler
        }
        if (event === 'error') {
          this.onerror = handler
        }
      }),
      stream: mockStream
    }

    // Mock window APIs
    global.MediaRecorder = vi.fn(() => mockMediaRecorder) as any
    global.MediaRecorder.isTypeSupported = vi.fn(() => true)
    
    global.navigator = {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve(mockStream))
      }
    } as any

    global.window = {
      MediaRecorder: global.MediaRecorder
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Recording Interface', () => {
    it('should provide recording state and methods', () => {
      const { result } = renderHook(() => useAudio())

      expect(result.current.isRecording).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.startRecording).toBe('function')
      expect(typeof result.current.stopRecording).toBe('function')
      expect(typeof result.current.getAudioData).toBe('function')
    })

    it('should start recording when startRecording is called', async () => {
      const { result } = renderHook(() => useAudio())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(true)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      expect(mockMediaRecorder.start).toHaveBeenCalledWith(1000)
    })

    it('should stop recording and return audio blob when stopRecording is called', async () => {
      const { result } = renderHook(() => useAudio())

      // Start recording first
      await act(async () => {
        await result.current.startRecording()
      })

      // Mock data available
      const mockBlob = new Blob(['test'], { type: 'audio/webm' })
      mockMediaRecorder.ondataavailable = vi.fn()
      
      // Simulate data chunks
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob })
        }
      })

      // Stop recording
      let audioBlob: Blob | null = null
      await act(async () => {
        audioBlob = await result.current.stopRecording()
      })

      expect(result.current.isRecording).toBe(false)
      expect(mockMediaRecorder.stop).toHaveBeenCalled()
      expect(audioBlob).toBeInstanceOf(Blob)
      expect(audioBlob?.type).toBe('audio/webm')
    })

    it('should return current audio data without stopping when getAudioData is called', async () => {
      const { result } = renderHook(() => useAudio())

      // Start recording
      await act(async () => {
        await result.current.startRecording()
      })

      // Add some mock data
      const mockBlob = new Blob(['test'], { type: 'audio/webm' })
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob })
        }
      })

      // Get audio data without stopping
      let audioData: Blob | null = null
      act(() => {
        audioData = result.current.getAudioData()
      })

      expect(result.current.isRecording).toBe(true) // Still recording
      expect(audioData).toBeInstanceOf(Blob)
      expect(audioData?.type).toBe('audio/webm')
    })
  })

  describe('Error Handling', () => {
    it('should handle getUserMedia permission errors', async () => {
      const permissionError = new Error('Permission denied')
      global.navigator.mediaDevices.getUserMedia = vi.fn(() => Promise.reject(permissionError))

      const { result } = renderHook(() => useAudio())

      await act(async () => {
        try {
          await result.current.startRecording()
        } catch (e) {
          // Expected error
        }
      })

      expect(result.current.isRecording).toBe(false)
      expect(result.current.error).toBe('録音エラーが発生しました')
    })

    it('should handle MediaRecorder not supported error', async () => {
      delete (global.window as any).MediaRecorder

      const { result } = renderHook(() => useAudio())

      await act(async () => {
        try {
          await result.current.startRecording()
        } catch (e) {
          // Expected error
        }
      })

      expect(result.current.isRecording).toBe(false)
      expect(result.current.error).toBe('録音エラーが発生しました')
    })

    it('should handle empty recording (no data)', async () => {
      const { result } = renderHook(() => useAudio())

      await act(async () => {
        await result.current.startRecording()
      })

      // Don't add any data chunks

      await act(async () => {
        try {
          await result.current.stopRecording()
        } catch (error) {
          // Expected error
        }
      })

      expect(result.current.isRecording).toBe(false)
    })
  })

  describe('Platform-specific Behavior', () => {
    it('should add delay for iOS Safari', async () => {
      const { DeviceDetection } = await import('@/lib/deviceDetection')
      vi.mocked(DeviceDetection.getDeviceInfo).mockReturnValue({
        isIOSSafari: true,
        isMobile: true,
        requiresUserGesture: true,
        isIOS: true,
        isSafari: true,
        isAndroid: false,
        isChrome: false,
        isFirefox: false,
        supportsMediaRecorder: true
      })

      const startTime = Date.now()
      const { result } = renderHook(() => useAudio())

      await act(async () => {
        await result.current.startRecording()
      })

      const elapsedTime = Date.now() - startTime
      expect(elapsedTime).toBeGreaterThanOrEqual(300) // iOS delay
      expect(result.current.isRecording).toBe(true)
    })

    it('should use appropriate MIME type based on platform', async () => {
      const { DeviceDetection } = await import('@/lib/deviceDetection')
      vi.mocked(DeviceDetection.getOptimalMimeType).mockReturnValue('audio/mp4')

      const { result } = renderHook(() => useAudio())

      await act(async () => {
        await result.current.startRecording()
      })

      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: new Blob(['test']) })
        }
      })

      const audioData = result.current.getAudioData()
      expect(audioData?.type).toBe('audio/mp4')
    })
  })

  describe('Cleanup', () => {
    it('should stop recording and clean up on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudio())

      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.isRecording).toBe(true)

      unmount()

      expect(mockMediaRecorder.stop).toHaveBeenCalled()
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
    })

    it('should release microphone when stopping', async () => {
      const { result } = renderHook(() => useAudio())

      await act(async () => {
        await result.current.startRecording()
      })

      await act(async () => {
        await result.current.stopRecording()
      })

      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
    })
  })

  describe('State Management', () => {
    it('should clear error when starting new recording', async () => {
      const { result } = renderHook(() => useAudio())

      // First, cause an error
      delete (global.window as any).MediaRecorder
      await act(async () => {
        try {
          await result.current.startRecording()
        } catch (e) {
          // Expected
        }
      })
      expect(result.current.error).toBe('録音エラーが発生しました')

      // Restore MediaRecorder
      global.window.MediaRecorder = vi.fn(() => mockMediaRecorder) as any

      // Start new recording should clear error
      await act(async () => {
        await result.current.startRecording()
      })

      expect(result.current.error).toBeNull()
    })

    it('should maintain recording chunks across multiple data events', async () => {
      const { result } = renderHook(() => useAudio())

      await act(async () => {
        await result.current.startRecording()
      })

      // Add multiple data chunks
      const chunk1 = new Blob(['chunk1'], { type: 'audio/webm' })
      const chunk2 = new Blob(['chunk2'], { type: 'audio/webm' })
      
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: chunk1 })
          mockMediaRecorder.ondataavailable({ data: chunk2 })
        }
      })

      const audioData = result.current.getAudioData()
      expect(audioData).toBeInstanceOf(Blob)
      expect(audioData?.size).toBeGreaterThan(0)
    })
  })
})
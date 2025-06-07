import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { useDiaryMessage } from './useDiaryMessage'
import { typedAPIClient } from '@/core/lib/apiClient'
import { useDiary } from './useDiary'
import { ErrorHandler } from '@/lib/errorHandling'

// Mock dependencies
vi.mock('./useDiary')
vi.mock('@/core/lib/apiClient')
vi.mock('@/lib/errorHandling', () => ({
  ErrorHandler: {
    fromUnknown: vi.fn()
  }
}))

describe('useDiaryMessage', () => {
  const mockUseDiary = useDiary as unknown as {
    createDiary: Mock
    addMessage: Mock
    getDiary: Mock
    getTodayDiary: Mock
    diary: any
    messages: any[]
    isLoading: boolean
    error: any
  }

  const mockAPIClient = typedAPIClient as unknown as {
    transcribeAudio: Mock
    chatWithAI: Mock
    textToSpeech: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock returns
    mockUseDiary.createDiary = vi.fn().mockResolvedValue(1)
    mockUseDiary.addMessage = vi.fn().mockResolvedValue(undefined)
    mockUseDiary.getDiary = vi.fn().mockResolvedValue(undefined)
    mockUseDiary.getTodayDiary = vi.fn().mockResolvedValue(undefined)
    mockUseDiary.diary = null
    mockUseDiary.messages = []
    mockUseDiary.isLoading = false
    mockUseDiary.error = null

    mockAPIClient.transcribeAudio = vi.fn().mockResolvedValue({ text: 'こんにちは' })
    mockAPIClient.chatWithAI = vi.fn().mockResolvedValue({ 
      response: '今日も素敵な一日ですね！', 
      audio_data: 'base64audiodata' 
    })
    mockAPIClient.textToSpeech = vi.fn().mockResolvedValue({ 
      audio_data: 'base64audiodata' 
    })
  })

  describe('sendMessage - Complete Flow', () => {
    it('should handle complete message flow from user input to AI response', async () => {
      const { result } = renderHook(() => useDiaryMessage())

      const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
      
      await act(async () => {
        await result.current.sendMessage({
          audioBlob,
          diaryId: 1
        })
      })

      // Verify transcription was called
      expect(mockAPIClient.transcribeAudio).toHaveBeenCalledWith(
        expect.any(FormData)
      )

      // Verify user message was added
      expect(mockUseDiary.addMessage).toHaveBeenCalledWith({
        diaryId: 1,
        role: 'user',
        text: 'こんにちは',
        audioUrl: undefined
      })

      // Verify AI response was fetched
      expect(mockAPIClient.chatWithAI).toHaveBeenCalledWith({
        message: 'こんにちは',
        messages: []
      })

      // Verify AI message was added
      expect(mockUseDiary.addMessage).toHaveBeenCalledWith({
        diaryId: 1,
        role: 'ai',
        text: '今日も素敵な一日ですね！',
        audioUrl: undefined
      })

      // Verify state updates
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.lastAIResponse).toEqual({
        text: '今日も素敵な一日ですね！',
        audioData: 'base64audiodata'
      })
    })

    it('should create diary if diaryId is not provided', async () => {
      const { result } = renderHook(() => useDiaryMessage())

      const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
      const today = new Date().toISOString().split('T')[0]

      await act(async () => {
        await result.current.sendMessage({
          audioBlob
        })
      })

      // Verify diary creation
      expect(mockUseDiary.createDiary).toHaveBeenCalledWith({
        date: today,
        text: 'こんにちは',
        audioPath: undefined
      })

      // Verify messages were added with created diary ID
      expect(mockUseDiary.addMessage).toHaveBeenCalledWith({
        diaryId: 1,
        role: 'user',
        text: 'こんにちは',
        audioUrl: undefined
      })
    })

    it('should handle text-only messages without audio', async () => {
      const { result } = renderHook(() => useDiaryMessage())

      await act(async () => {
        await result.current.sendMessage({
          text: '今日は良い天気ですね',
          diaryId: 1
        })
      })

      // Should skip transcription
      expect(mockAPIClient.transcribeAudio).not.toHaveBeenCalled()

      // Should add user message directly
      expect(mockUseDiary.addMessage).toHaveBeenCalledWith({
        diaryId: 1,
        role: 'user',
        text: '今日は良い天気ですね',
        audioUrl: undefined
      })

      // Should still get AI response
      expect(mockAPIClient.chatWithAI).toHaveBeenCalled()
    })

    it('should include conversation context when getting AI response', async () => {
      mockUseDiary.messages = [
        { id: 1, diary_id: 1, role: 'user', text: '昨日の話', created_at: '2024-12-18' },
        { id: 2, diary_id: 1, role: 'ai', text: '昨日はどうでしたか？', created_at: '2024-12-18' }
      ]

      const { result } = renderHook(() => useDiaryMessage())

      await act(async () => {
        await result.current.sendMessage({
          text: '今日の話',
          diaryId: 1
        })
      })

      expect(mockAPIClient.chatWithAI).toHaveBeenCalledWith({
        message: '今日の話',
        messages: mockUseDiary.messages
      })
    })

    it('should handle transcription errors gracefully', async () => {
      const mockError = new Error('Transcription failed')
      mockAPIClient.transcribeAudio.mockRejectedValueOnce(mockError)

      const mockErrorHandler = {
        getUserMessage: vi.fn().mockReturnValue('音声の処理に失敗しました'),
        category: 'transcription'
      }
      ;(ErrorHandler.fromUnknown as Mock).mockReturnValue(mockErrorHandler)

      const { result } = renderHook(() => useDiaryMessage())

      const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

      await act(async () => {
        await result.current.sendMessage({
          audioBlob,
          diaryId: 1
        })
      })

      expect(result.current.error).toBe(mockErrorHandler)
      expect(result.current.isProcessing).toBe(false)
      expect(mockUseDiary.addMessage).not.toHaveBeenCalled()
    })

    it('should handle AI response errors gracefully', async () => {
      const mockError = new Error('AI API failed')
      mockAPIClient.chatWithAI.mockRejectedValueOnce(mockError)

      const mockErrorHandler = {
        getUserMessage: vi.fn().mockReturnValue('AIの応答取得に失敗しました'),
        category: 'ai'
      }
      ;(ErrorHandler.fromUnknown as Mock).mockReturnValue(mockErrorHandler)

      const { result } = renderHook(() => useDiaryMessage())

      await act(async () => {
        await result.current.sendMessage({
          text: 'テスト',
          diaryId: 1
        })
      })

      // User message should still be saved
      expect(mockUseDiary.addMessage).toHaveBeenCalledTimes(1)
      expect(mockUseDiary.addMessage).toHaveBeenCalledWith({
        diaryId: 1,
        role: 'user',
        text: 'テスト',
        audioUrl: undefined
      })

      // Error should be set
      expect(result.current.error).toBe(mockErrorHandler)
      expect(result.current.isProcessing).toBe(false)
    })

    it('should track processing state throughout the flow', async () => {
      const { result } = renderHook(() => useDiaryMessage())

      let processingStates: boolean[] = []

      // Track processing state changes
      const originalSendMessage = result.current.sendMessage
      result.current.sendMessage = async (...args) => {
        processingStates.push(result.current.isProcessing)
        const promise = originalSendMessage(...args)
        processingStates.push(result.current.isProcessing)
        await promise
        processingStates.push(result.current.isProcessing)
        return promise
      }

      await act(async () => {
        await result.current.sendMessage({
          text: 'テスト',
          diaryId: 1
        })
      })

      // Should start false, become true during processing, then false again
      expect(processingStates[0]).toBe(false)
      expect(processingStates[1]).toBe(true)
      expect(processingStates[2]).toBe(false)
    })

    it('should support audio URL upload', async () => {
      const { result } = renderHook(() => useDiaryMessage())

      const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
      
      await act(async () => {
        await result.current.sendMessage({
          audioBlob,
          diaryId: 1,
          uploadAudio: true
        })
      })

      // Verify FormData includes upload flag
      const formDataCall = mockAPIClient.transcribeAudio.mock.calls[0][0] as FormData
      expect(formDataCall).toBeInstanceOf(FormData)
    })

    it('should handle generateTTS option for AI responses', async () => {
      const { result } = renderHook(() => useDiaryMessage())

      await act(async () => {
        await result.current.sendMessage({
          text: 'テスト',
          diaryId: 1,
          generateTTS: true
        })
      })

      // Should generate TTS for AI response
      expect(mockAPIClient.textToSpeech).toHaveBeenCalledWith({
        text: '今日も素敵な一日ですね！'
      })

      expect(result.current.lastAIResponse?.audioData).toBe('base64audiodata')
    })

    it('should not generate TTS when generateTTS is false', async () => {
      mockAPIClient.chatWithAI.mockResolvedValueOnce({ 
        response: '今日も素敵な一日ですね！'
        // No audio_data returned
      })

      const { result } = renderHook(() => useDiaryMessage())

      await act(async () => {
        await result.current.sendMessage({
          text: 'テスト',
          diaryId: 1,
          generateTTS: false
        })
      })

      // Should not call TTS endpoint
      expect(mockAPIClient.textToSpeech).not.toHaveBeenCalled()

      expect(result.current.lastAIResponse).toEqual({
        text: '今日も素敵な一日ですね！',
        audioData: undefined
      })
    })

    it('should clear error when starting new message', async () => {
      const mockErrorHandler = {
        getUserMessage: vi.fn().mockReturnValue('エラー'),
        category: 'unknown'
      }

      const { result } = renderHook(() => useDiaryMessage())

      // Set initial error
      act(() => {
        result.current.error = mockErrorHandler
      })

      expect(result.current.error).toBe(mockErrorHandler)

      // Start new message
      await act(async () => {
        const promise = result.current.sendMessage({
          text: 'テスト',
          diaryId: 1
        })
        
        // Error should be cleared immediately
        expect(result.current.error).toBeNull()
        
        await promise
      })
    })

    it('should return message IDs for tracking', async () => {
      mockUseDiary.addMessage
        .mockResolvedValueOnce({ id: 100, diary_id: 1, role: 'user', text: 'テスト' })
        .mockResolvedValueOnce({ id: 101, diary_id: 1, role: 'ai', text: 'レスポンス' })

      const { result } = renderHook(() => useDiaryMessage())

      let messageResult: any

      await act(async () => {
        messageResult = await result.current.sendMessage({
          text: 'テスト',
          diaryId: 1
        })
      })

      expect(messageResult).toEqual({
        userMessageId: 100,
        aiMessageId: 101,
        diaryId: 1
      })
    })

    it('should handle empty or whitespace-only text', async () => {
      const { result } = renderHook(() => useDiaryMessage())

      await act(async () => {
        await result.current.sendMessage({
          text: '   ',
          diaryId: 1
        })
      })

      // Should not process empty messages
      expect(mockUseDiary.addMessage).not.toHaveBeenCalled()
      expect(mockAPIClient.chatWithAI).not.toHaveBeenCalled()
    })

    it('should provide loading states from useDiary', () => {
      mockUseDiary.isLoading = true
      mockUseDiary.messages = [
        { id: 1, diary_id: 1, role: 'user', text: 'テスト', created_at: '2024-12-19' }
      ]
      
      const { result } = renderHook(() => useDiaryMessage())

      expect(result.current.isLoadingDiary).toBe(true)
      expect(result.current.messages).toEqual(mockUseDiary.messages)
    })
  })

  describe('clearError', () => {
    it('should clear error state', () => {
      const mockErrorHandler = {
        getUserMessage: vi.fn().mockReturnValue('エラー'),
        category: 'unknown'
      }

      const { result } = renderHook(() => useDiaryMessage())

      act(() => {
        result.current.error = mockErrorHandler
      })

      expect(result.current.error).toBe(mockErrorHandler)

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('Integration with useDiary', () => {
    it('should expose diary operations from useDiary', () => {
      const { result } = renderHook(() => useDiaryMessage())

      expect(result.current.diary).toBe(mockUseDiary.diary)
      expect(result.current.messages).toBe(mockUseDiary.messages)
      expect(result.current.getDiary).toBe(mockUseDiary.getDiary)
      expect(result.current.getTodayDiary).toBe(mockUseDiary.getTodayDiary)
    })
  })
})
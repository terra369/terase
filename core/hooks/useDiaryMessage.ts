import { useState, useCallback } from 'react'
import { useDiary } from './useDiary'
import { typedAPIClient } from '@/core/lib/apiClient'
import { ErrorHandler } from '@/lib/errorHandling'

interface SendMessageOptions {
  audioBlob?: Blob
  text?: string
  diaryId?: number
  uploadAudio?: boolean
  generateTTS?: boolean
}

interface MessageResult {
  userMessageId?: number
  aiMessageId?: number
  diaryId: number
}

interface AIResponse {
  text: string
  audioData?: string
}

export function useDiaryMessage() {
  const {
    diary,
    messages,
    isLoading: isLoadingDiary,
    error: diaryError,
    createDiary,
    addMessage,
    getDiary,
    getTodayDiary
  } = useDiary()

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<ErrorHandler | null>(null)
  const [lastAIResponse, setLastAIResponse] = useState<AIResponse | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const sendMessage = useCallback(async (options: SendMessageOptions): Promise<MessageResult> => {
    const { audioBlob, text, diaryId: providedDiaryId, uploadAudio = false, generateTTS = true } = options

    // Clear any existing error
    setError(null)
    setIsProcessing(true)
    setLastAIResponse(null)

    try {
      let messageText = text || ''
      let audioUrl: string | undefined

      // Step 1: Transcribe audio if provided
      if (audioBlob) {
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob)
          if (uploadAudio) {
            formData.append('upload', 'true')
          }

          const transcriptionResult = await typedAPIClient.transcribeAudio(formData)
          messageText = transcriptionResult.text
          audioUrl = transcriptionResult.audioUrl
        } catch (error) {
          throw ErrorHandler.fromUnknown(error, 'transcription')
        }
      }

      // Validate message text
      if (!messageText || !messageText.trim()) {
        setIsProcessing(false)
        return { diaryId: 0 }
      }

      // Step 2: Create diary if not provided
      let diaryId = providedDiaryId
      if (!diaryId) {
        const today = new Date().toISOString().split('T')[0]
        diaryId = await createDiary({
          date: today,
          text: messageText,
          audioPath: audioUrl
        })
      }

      // Step 3: Add user message
      const userMessage = await addMessage({
        diaryId,
        role: 'user',
        text: messageText,
        audioUrl
      })

      let aiMessageId: number | undefined

      try {
        // Step 4: Get AI response
        const aiResponse = await typedAPIClient.chatWithAI({
          message: messageText,
          messages: messages || []
        })

        // Step 5: Generate TTS if needed and not already provided
        let audioData = aiResponse.audio_data
        if (generateTTS && !audioData && aiResponse.response) {
          try {
            const ttsResult = await typedAPIClient.textToSpeech({
              text: aiResponse.response
            })
            audioData = ttsResult.audio_data
          } catch (error) {
            // TTS failure is not critical
            console.error('TTS generation failed:', error)
          }
        }

        // Step 6: Add AI message
        const aiMessage = await addMessage({
          diaryId,
          role: 'ai',
          text: aiResponse.response,
          audioUrl: undefined // Audio is handled client-side
        })

        aiMessageId = aiMessage?.id

        // Update last AI response
        setLastAIResponse({
          text: aiResponse.response,
          audioData
        })
      } catch (error) {
        // AI errors are thrown after user message is saved
        const errorHandler = ErrorHandler.fromUnknown(error, 'ai')
        setError(errorHandler)
      }

      setIsProcessing(false)

      return {
        userMessageId: userMessage?.id,
        aiMessageId,
        diaryId
      }
    } catch (error) {
      const errorHandler = error instanceof ErrorHandler 
        ? error 
        : ErrorHandler.fromUnknown(error, 'unknown')
      setError(errorHandler)
      setIsProcessing(false)
      throw errorHandler
    }
  }, [messages, createDiary, addMessage])

  return {
    // Message operations
    sendMessage,
    
    // State
    isProcessing,
    error,
    lastAIResponse,
    
    // Error management
    clearError,
    
    // Diary state from useDiary
    diary,
    messages,
    isLoadingDiary,
    diaryError,
    
    // Diary operations from useDiary
    getDiary,
    getTodayDiary
  }
}
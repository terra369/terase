/**
 * Platform-agnostic conversation flow business logic
 * Core conversation management for Web/React Native reusability
 */

import type { 
  AudioBlob, 
  ConversationContext, 
  ConversationMessage,
  APIResponse,
} from '../api/types'
import type { AIChatService } from '../api/services/ai-chat'
import type { TranscriptionService } from '../api/services/transcription'
import type { TTSService } from '../api/services/tts'
import type { AudioRecordingStateMachine } from '../audio/state-machine'

export interface ConversationFlowOptions {
  enableAutoTTS?: boolean
  enableTranscription?: boolean
  maxRetries?: number
  language?: string
}

export interface ConversationFlowResult {
  success: boolean
  userMessage?: ConversationMessage
  aiResponse?: ConversationMessage
  error?: string
  audioBlob?: AudioBlob
}

export interface ConversationServices {
  aiChat: AIChatService
  transcription: TranscriptionService
  tts: TTSService
  stateMachine: AudioRecordingStateMachine
}

export class ConversationFlow {
  private services: ConversationServices
  private options: ConversationFlowOptions

  constructor(services: ConversationServices, options: ConversationFlowOptions = {}) {
    this.services = services
    this.options = {
      enableAutoTTS: true,
      enableTranscription: true,
      maxRetries: 3,
      language: 'ja',
      ...options,
    }
  }

  async processAudioMessage(
    audioBlob: AudioBlob,
    context?: ConversationContext
  ): Promise<ConversationFlowResult> {
    try {
      // Step 1: Transcribe audio to text
      let userText = ''
      if (this.options.enableTranscription) {
        const transcriptionResult = await this.transcribeAudio(audioBlob)
        if (!transcriptionResult.success) {
          return {
            success: false,
            error: transcriptionResult.error || '音声認識に失敗しました',
            audioBlob,
          }
        }
        userText = transcriptionResult.text!
      }

      // Step 2: Create user message
      const userMessage: ConversationMessage = {
        role: 'user',
        text: userText,
        timestamp: new Date(),
      }

      // Step 3: Get AI response
      const aiResponseResult = await this.getAIResponse(userText, context)
      if (!aiResponseResult.success) {
        return {
          success: false,
          error: aiResponseResult.error || 'AI応答の生成に失敗しました',
          userMessage,
          audioBlob,
        }
      }

      // Step 4: Create AI message
      let aiMessage: ConversationMessage = {
        role: 'ai',
        text: aiResponseResult.response!,
        timestamp: new Date(),
      }

      // Step 5: Generate TTS audio for AI response (optional)
      if (this.options.enableAutoTTS && aiResponseResult.response) {
        const ttsResult = await this.generateTTS(aiResponseResult.response)
        if (ttsResult.success && ttsResult.audioUrl) {
          aiMessage.audioUrl = ttsResult.audioUrl
        }
      }

      return {
        success: true,
        userMessage,
        aiResponse: aiMessage,
        audioBlob,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '会話処理中にエラーが発生しました',
        audioBlob,
      }
    }
  }

  async processTextMessage(
    text: string,
    context?: ConversationContext
  ): Promise<ConversationFlowResult> {
    try {
      // Step 1: Create user message
      const userMessage: ConversationMessage = {
        role: 'user',
        text,
        timestamp: new Date(),
      }

      // Step 2: Get AI response
      const aiResponseResult = await this.getAIResponse(text, context)
      if (!aiResponseResult.success) {
        return {
          success: false,
          error: aiResponseResult.error || 'AI応答の生成に失敗しました',
          userMessage,
        }
      }

      // Step 3: Create AI message
      let aiMessage: ConversationMessage = {
        role: 'ai',
        text: aiResponseResult.response!,
        timestamp: new Date(),
      }

      // Step 4: Generate TTS audio for AI response (optional)
      if (this.options.enableAutoTTS && aiResponseResult.response) {
        const ttsResult = await this.generateTTS(aiResponseResult.response)
        if (ttsResult.success && ttsResult.audioUrl) {
          aiMessage.audioUrl = ttsResult.audioUrl
        }
      }

      return {
        success: true,
        userMessage,
        aiResponse: aiMessage,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '会話処理中にエラーが発生しました',
      }
    }
  }

  async continueConversation(
    messages: ConversationMessage[],
    newMessage: string,
    context?: ConversationContext
  ): Promise<ConversationFlowResult> {
    const updatedContext: ConversationContext = {
      ...context,
      previousMessages: messages,
    }

    return this.processTextMessage(newMessage, updatedContext)
  }

  private async transcribeAudio(audioBlob: AudioBlob): Promise<{
    success: boolean
    text?: string
    error?: string
  }> {
    let retries = 0
    
    while (retries < this.options.maxRetries!) {
      try {
        const result = await this.services.transcription.transcribeAudio(audioBlob, {
          language: this.options.language,
        })

        if (result.success && result.data?.text) {
          return {
            success: true,
            text: result.data.text,
          }
        } else {
          throw new Error(result.error || '転写に失敗しました')
        }
      } catch (error) {
        retries++
        if (retries >= this.options.maxRetries!) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '音声認識に失敗しました',
          }
        }
        
        // Wait before retry with exponential backoff
        await this.delay(1000 * Math.pow(2, retries - 1))
      }
    }

    return {
      success: false,
      error: '音声認識の最大試行回数に達しました',
    }
  }

  private async getAIResponse(
    message: string,
    context?: ConversationContext
  ): Promise<{
    success: boolean
    response?: string
    error?: string
  }> {
    let retries = 0
    
    while (retries < this.options.maxRetries!) {
      try {
        const result = await this.services.aiChat.sendMessage(message, context)

        if (result.success && result.data?.response) {
          return {
            success: true,
            response: result.data.response,
          }
        } else {
          throw new Error(result.error || 'AI応答の生成に失敗しました')
        }
      } catch (error) {
        retries++
        if (retries >= this.options.maxRetries!) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'AI応答の生成に失敗しました',
          }
        }
        
        // Wait before retry with exponential backoff
        await this.delay(1000 * Math.pow(2, retries - 1))
      }
    }

    return {
      success: false,
      error: 'AI応答生成の最大試行回数に達しました',
    }
  }

  private async generateTTS(text: string): Promise<{
    success: boolean
    audioUrl?: string
    error?: string
  }> {
    try {
      const result = await this.services.tts.synthesizeSpeech(text, {
        voice: 'alloy',
        speed: 1.0,
      })

      if (result.success && result.data?.audioUrl) {
        return {
          success: true,
          audioUrl: result.data.audioUrl,
        }
      } else {
        return {
          success: false,
          error: result.error || '音声合成に失敗しました',
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '音声合成に失敗しました',
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Utility methods
  setOptions(options: Partial<ConversationFlowOptions>): void {
    this.options = { ...this.options, ...options }
  }

  getOptions(): ConversationFlowOptions {
    return { ...this.options }
  }

  isTranscriptionEnabled(): boolean {
    return this.options.enableTranscription || false
  }

  isTTSEnabled(): boolean {
    return this.options.enableAutoTTS || false
  }
}

// Factory function for creating conversation flow instances
export const createConversationFlow = (
  services: ConversationServices,
  options?: ConversationFlowOptions
): ConversationFlow => {
  return new ConversationFlow(services, options)
}
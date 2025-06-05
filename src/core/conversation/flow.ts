/**
 * Core conversation flow management
 * Shared between Web and Mobile platforms
 */

import { DiaryService } from '../diary/operations'
import { transcribeAudio, generateAIResponse, generateTTS } from '../api/openai'
import { ErrorUtils } from '../utils/errorHandling'

export interface ConversationMessage {
  role: 'user' | 'ai'
  text: string
  audioUrl?: string
  timestamp: string
}

export interface ConversationState {
  status: 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'
  messages: ConversationMessage[]
  error?: string
  isProcessing: boolean
}

export interface ConversationOptions {
  onStateChange?: (state: ConversationState) => void
  onMessage?: (message: ConversationMessage) => void
  onError?: (error: string) => void
  onProgress?: (progress: number) => void
  userId?: string
  diaryId?: number
}

export class ConversationFlow {
  private state: ConversationState
  private options: ConversationOptions
  private diaryService: DiaryService

  constructor(options: ConversationOptions = {}) {
    this.options = options
    this.diaryService = new DiaryService()
    this.state = {
      status: 'idle',
      messages: [],
      isProcessing: false
    }
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return { ...this.state }
  }

  /**
   * Process complete conversation flow from audio blob
   */
  async processAudioConversation(audioBlob: Blob, userId: string): Promise<void> {
    try {
      this.updateState({ status: 'transcribing', isProcessing: true })

      // 1. Transcribe audio to text
      const transcript = await this.transcribeUserAudio(audioBlob)
      
      // 2. Upload audio and save to diary
      const { diary, userMessage } = await this.saveUserMessage(userId, transcript, audioBlob)
      
      // 3. Add user message to conversation
      this.addMessage({
        role: 'user',
        text: transcript,
        audioUrl: userMessage.audio_url,
        timestamp: userMessage.created_at
      })

      // 4. Generate AI response
      const aiResponse = await this.generateAIResponse(diary.id, transcript)
      
      // 5. Generate TTS for AI response
      const aiAudioBuffer = await this.generateAIAudio(aiResponse)
      
      // 6. Save AI response to diary
      const aiAudioUrl = await this.saveAIResponse(diary.id, aiResponse, aiAudioBuffer)
      
      // 7. Add AI message to conversation
      this.addMessage({
        role: 'ai',
        text: aiResponse,
        audioUrl: aiAudioUrl,
        timestamp: new Date().toISOString()
      })

      this.updateState({ status: 'idle', isProcessing: false })

    } catch (error) {
      const errorHandler = ErrorUtils.fromUnknown(error)
      errorHandler.log()
      
      this.updateState({ 
        status: 'idle', 
        isProcessing: false,
        error: errorHandler.getUserMessage()
      })
      
      this.options.onError?.(errorHandler.getUserMessage())
      throw error
    }
  }

  /**
   * Process text-only conversation (without audio recording)
   */
  async processTextConversation(text: string, userId: string): Promise<void> {
    try {
      this.updateState({ status: 'thinking', isProcessing: true })

      // 1. Save user message to diary
      const { diary, userMessage } = await this.saveUserMessage(userId, text)
      
      // 2. Add user message to conversation
      this.addMessage({
        role: 'user',
        text,
        timestamp: userMessage.created_at
      })

      // 3. Generate AI response
      const aiResponse = await this.generateAIResponse(diary.id, text)
      
      // 4. Save AI response to diary
      await this.saveAIResponse(diary.id, aiResponse)
      
      // 5. Add AI message to conversation
      this.addMessage({
        role: 'ai',
        text: aiResponse,
        timestamp: new Date().toISOString()
      })

      this.updateState({ status: 'idle', isProcessing: false })

    } catch (error) {
      const errorHandler = ErrorUtils.fromUnknown(error)
      errorHandler.log()
      
      this.updateState({ 
        status: 'idle', 
        isProcessing: false,
        error: errorHandler.getUserMessage()
      })
      
      this.options.onError?.(errorHandler.getUserMessage())
      throw error
    }
  }

  /**
   * Load conversation history from diary
   */
  async loadConversationHistory(diaryId: number): Promise<void> {
    try {
      const messages = await this.diaryService.getDiaryMessages(diaryId)
      
      const conversationMessages: ConversationMessage[] = messages.map(msg => ({
        role: msg.role,
        text: msg.text,
        audioUrl: msg.audio_url || undefined,
        timestamp: msg.created_at
      }))

      this.updateState({ messages: conversationMessages })

    } catch (error) {
      const errorHandler = ErrorUtils.fromUnknown(error)
      errorHandler.log()
      this.options.onError?.(errorHandler.getUserMessage())
    }
  }

  /**
   * Clear conversation state
   */
  reset(): void {
    this.state = {
      status: 'idle',
      messages: [],
      isProcessing: false
    }
    this.options.onStateChange?.(this.state)
  }

  /**
   * Private methods
   */

  private async transcribeUserAudio(audioBlob: Blob): Promise<string> {
    this.updateState({ status: 'transcribing' })
    return await transcribeAudio(audioBlob)
  }

  private async saveUserMessage(userId: string, text: string, audioBlob?: Blob) {
    // Get or create today's diary
    const diary = await this.diaryService.getOrCreateTodayDiary(userId)
    
    // Upload audio if provided
    let audioUrl: string | undefined
    if (audioBlob) {
      audioUrl = await this.diaryService.uploadAudio(audioBlob)
    }
    
    // Save message
    const message = await this.diaryService.saveMessage(diary.id, {
      role: 'user',
      text,
      audio_url: audioUrl
    })

    return { diary, userMessage: message }
  }

  private async generateAIResponse(diaryId: number, userText: string): Promise<string> {
    this.updateState({ status: 'thinking' })
    
    // Get conversation history for context
    const history = await this.diaryService.getConversationHistory(diaryId)
    
    // Add current user message to context
    const messages = [
      ...history,
      { role: 'user' as const, content: userText }
    ]

    const systemPrompt = `あなたは感謝日記アプリの優しいAIコンパニオンです。
ユーザーの日記内容に対して、共感的で温かい返答をしてください。
感謝の気持ちを大切にし、ポジティブな視点を提供してください。`

    return await generateAIResponse(messages, systemPrompt)
  }

  private async generateAIAudio(text: string): Promise<ArrayBuffer> {
    this.updateState({ status: 'speaking' })
    return await generateTTS(text)
  }

  private async saveAIResponse(diaryId: number, text: string, audioBuffer?: ArrayBuffer): Promise<string | undefined> {
    let audioUrl: string | undefined
    
    if (audioBuffer) {
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
      audioUrl = await this.diaryService.uploadAudio(audioBlob, `ai_response_${Date.now()}.mp3`)
    }

    await this.diaryService.saveAIResponse(diaryId, text, audioUrl)
    
    return audioUrl
  }

  private addMessage(message: ConversationMessage): void {
    this.state.messages.push(message)
    this.options.onMessage?.(message)
    this.options.onStateChange?.(this.state)
  }

  private updateState(updates: Partial<ConversationState>): void {
    this.state = { ...this.state, ...updates }
    this.options.onStateChange?.(this.state)
  }
}

// Utility functions for conversation management
export const ConversationUtils = {
  /**
   * Create a formatted conversation history for AI context
   */
  formatForAI(messages: ConversationMessage[]) {
    return messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: msg.text
    }))
  },

  /**
   * Get recent messages (for context window management)
   */
  getRecentMessages(messages: ConversationMessage[], limit = 10): ConversationMessage[] {
    return messages.slice(-limit)
  },

  /**
   * Calculate conversation duration
   */
  getConversationDuration(messages: ConversationMessage[]): number {
    if (messages.length < 2) return 0
    
    const first = new Date(messages[0].timestamp)
    const last = new Date(messages[messages.length - 1].timestamp)
    
    return last.getTime() - first.getTime()
  },

  /**
   * Count messages by role
   */
  getMessageCounts(messages: ConversationMessage[]): { user: number; ai: number } {
    return messages.reduce(
      (counts, msg) => {
        counts[msg.role]++
        return counts
      },
      { user: 0, ai: 0 }
    )
  }
}
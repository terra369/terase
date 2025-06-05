/**
 * Platform-agnostic AI chat service
 * Core OpenAI integration for Web/React Native reusability
 */

import type { APIClient } from '../client'
import type { 
  AIChatRequest, 
  ConversationContext, 
  ConversationMessage,
  APIResponse 
} from '../types'
import { validateSchema, AIChatSchema } from '../schemas'

export interface AIChatResponse {
  response: string
  audioUrl?: string
  context?: string
}

export class AIChatService {
  constructor(private apiClient: APIClient) {}

  async sendMessage(
    message: string,
    context?: ConversationContext
  ): Promise<APIResponse<AIChatResponse>> {
    // Validate input
    const requestData: AIChatRequest = validateSchema(AIChatSchema, {
      message,
      diaryId: context?.diaryId,
      context: this.buildContextString(context),
    })

    // Send request to AI chat endpoint
    return this.apiClient.post<AIChatResponse>('/api/ai-chat', requestData)
  }

  async continueConversation(
    message: string,
    diaryId: number,
    previousMessages: ConversationMessage[]
  ): Promise<APIResponse<AIChatResponse>> {
    const context: ConversationContext = {
      diaryId,
      previousMessages,
    }

    return this.sendMessage(message, context)
  }

  private buildContextString(context?: ConversationContext): string | undefined {
    if (!context) return undefined

    const parts: string[] = []

    // Add user profile context
    if (context.userProfile) {
      parts.push(`ユーザー名: ${context.userProfile.displayName}`)
      parts.push(`フェアリー名: ${context.userProfile.fairyName}`)
    }

    // Add conversation settings
    if (context.settings) {
      parts.push(`言語: ${context.settings.language}`)
      parts.push(`応答の長さ: ${context.settings.responseLength}`)
      parts.push(`AI性格: ${context.settings.aiPersonality}`)
    }

    // Add recent conversation history
    if (context.previousMessages && context.previousMessages.length > 0) {
      parts.push('前回までの会話:')
      const recentMessages = context.previousMessages.slice(-3) // Last 3 messages
      
      recentMessages.forEach(msg => {
        const role = msg.role === 'user' ? 'ユーザー' : 'フェアリー'
        parts.push(`${role}: ${msg.text}`)
      })
    }

    return parts.length > 0 ? parts.join('\n') : undefined
  }
}

// Factory function for easy instantiation
export const createAIChatService = (apiClient: APIClient): AIChatService => {
  return new AIChatService(apiClient)
}
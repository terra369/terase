/**
 * Platform-agnostic Text-to-Speech service
 * Core OpenAI TTS integration for Web/React Native reusability
 */

import type { APIClient } from '../client'
import type { TTSRequest, APIResponse, AudioBlob } from '../types'
import { validateSchema, TTSSchema } from '../schemas'

export interface TTSResponse {
  audioUrl: string
  audioBlob?: AudioBlob
  duration?: number
}

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  speed?: number
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac'
  model?: 'tts-1' | 'tts-1-hd'
}

export class TTSService {
  constructor(private apiClient: APIClient) {}

  async synthesizeSpeech(
    text: string,
    options: TTSOptions = {}
  ): Promise<APIResponse<TTSResponse>> {
    // Validate input
    const requestData: TTSRequest = validateSchema(TTSSchema, {
      text: this.preprocessText(text),
      voice: options.voice || 'alloy',
      speed: options.speed || 1.0,
    })

    // Add additional options
    const fullRequest = {
      ...requestData,
      model: options.model || 'tts-1',
      response_format: options.responseFormat || 'mp3',
    }

    // Send request to TTS endpoint
    return this.apiClient.post<TTSResponse>('/api/tts', fullRequest)
  }

  async synthesizeWithStreaming(
    text: string,
    options: TTSOptions = {},
    onChunk?: (chunk: ArrayBuffer) => void
  ): Promise<APIResponse<TTSResponse>> {
    // For streaming TTS, we need to handle the response differently
    // This would require platform-specific streaming implementation
    const response = await this.synthesizeSpeech(text, {
      ...options,
      responseFormat: 'mp3', // Streaming works best with MP3
    })

    if (response.success && response.data?.audioBlob && onChunk) {
      // Simulate streaming by chunking the audio blob
      const arrayBuffer = await response.data.audioBlob.blob.arrayBuffer()
      const chunkSize = 4096
      
      for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
        const chunk = arrayBuffer.slice(i, i + chunkSize)
        onChunk(chunk)
      }
    }

    return response
  }

  async batchSynthesize(
    texts: string[],
    options: TTSOptions = {}
  ): Promise<APIResponse<TTSResponse[]>> {
    // Process multiple texts
    const synthesisPromises = texts.map(text =>
      this.synthesizeSpeech(text, options)
    )

    try {
      const results = await Promise.all(synthesisPromises)
      const synthesizedAudio = results
        .filter(result => result.success && result.data)
        .map(result => result.data!)

      return {
        success: true,
        data: synthesizedAudio,
      }
    } catch (error) {
      return {
        success: false,
        error: 'バッチ音声合成処理でエラーが発生しました',
      }
    }
  }

  private preprocessText(text: string): string {
    // Clean up text for better TTS pronunciation
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Add pauses for better pacing
      .replace(/([.。!！?？])\s*/g, '$1 ')
      // Handle Japanese punctuation
      .replace(/、/g, '、 ')
      // Limit length to prevent API errors
      .substring(0, 4000)
  }

  // Utility method to estimate audio duration
  static estimateAudioDuration(text: string, speed: number = 1.0): number {
    // Rough estimation: ~150 words per minute for Japanese
    // Adjust for different languages and speaking speeds
    const wordsPerMinute = 150 * speed
    const estimatedWords = text.length / 2 // Rough estimate for Japanese
    return (estimatedWords / wordsPerMinute) * 60 // Convert to seconds
  }

  // Utility method to validate text length
  static isValidTextLength(text: string): boolean {
    return text.length > 0 && text.length <= 4000
  }

  // Utility method to split long text into chunks
  static splitTextForTTS(text: string, maxLength: number = 4000): string[] {
    if (text.length <= maxLength) {
      return [text]
    }

    const chunks: string[] = []
    const sentences = text.split(/([.。!！?？])/g)
    let currentChunk = ''

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '')
      
      if (currentChunk.length + sentence.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          // Sentence itself is too long, split it
          chunks.push(sentence.substring(0, maxLength))
          currentChunk = sentence.substring(maxLength)
        }
      } else {
        currentChunk += sentence
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }
}

// Factory function for easy instantiation
export const createTTSService = (apiClient: APIClient): TTSService => {
  return new TTSService(apiClient)
}
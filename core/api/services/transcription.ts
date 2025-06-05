/**
 * Platform-agnostic transcription service
 * Core OpenAI Whisper integration for Web/React Native reusability
 */

import type { APIClient } from '../client'
import type { TranscribeRequest, APIResponse, AudioBlob } from '../types'
import { validateSchema, TranscribeSchema } from '../schemas'

export interface TranscriptionResponse {
  text: string
  language?: string
  confidence?: number
  duration?: number
}

export interface TranscriptionOptions {
  language?: string
  prompt?: string
  temperature?: number
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
}

export class TranscriptionService {
  constructor(private apiClient: APIClient) {}

  async transcribeAudio(
    audioBlob: AudioBlob,
    options: TranscriptionOptions = {}
  ): Promise<APIResponse<TranscriptionResponse>> {
    // Prepare request data - let schema handle defaults
    const requestData: TranscribeRequest = validateSchema(TranscribeSchema, {
      audio: {
        type: `audio/${audioBlob.format}`,
        size: audioBlob.size,
      },
      ...(options.language && { language: options.language }),
    })

    // Convert AudioBlob to FormData for upload
    const formData = this.createFormData(audioBlob, options)

    // Send request to transcription endpoint
    return this.apiClient.post<TranscriptionResponse>('/api/transcribe', formData, {
      headers: {
        // Let the platform handle Content-Type for FormData
        'Content-Type': undefined as any,
      },
    })
  }

  async transcribeFromUrl(
    audioUrl: string,
    options: TranscriptionOptions = {}
  ): Promise<APIResponse<TranscriptionResponse>> {
    // For URL-based transcription, send URL in request body
    return this.apiClient.post<TranscriptionResponse>('/api/transcribe', {
      audioUrl,
      ...options,
    })
  }

  async batchTranscribe(
    audioBlobs: AudioBlob[],
    options: TranscriptionOptions = {}
  ): Promise<APIResponse<TranscriptionResponse[]>> {
    // Process multiple audio files
    const transcriptionPromises = audioBlobs.map(blob =>
      this.transcribeAudio(blob, options)
    )

    try {
      const results = await Promise.all(transcriptionPromises)
      const transcriptions = results
        .filter(result => result.success && result.data)
        .map(result => result.data!)

      return {
        success: true,
        data: transcriptions,
      }
    } catch (error) {
      return {
        success: false,
        error: 'バッチ転写処理でエラーが発生しました',
      }
    }
  }

  private createFormData(audioBlob: AudioBlob, options: TranscriptionOptions): FormData {
    const formData = new FormData()
    
    // Add audio file
    const filename = `audio.${audioBlob.format}`
    formData.append('file', audioBlob.blob, filename)
    
    // Add transcription options
    formData.append('model', 'whisper-1')
    
    if (options.language) {
      formData.append('language', options.language)
    }
    
    if (options.prompt) {
      formData.append('prompt', options.prompt)
    }
    
    if (options.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString())
    }
    
    if (options.responseFormat) {
      formData.append('response_format', options.responseFormat)
    }

    return formData
  }

  // Utility method to validate audio format for transcription
  static isValidAudioFormat(format: string): boolean {
    const supportedFormats = [
      'flac', 'mp3', 'mp4', 'mpeg', 'mpga', 
      'm4a', 'ogg', 'wav', 'webm'
    ]
    return supportedFormats.includes(format.toLowerCase())
  }

  // Utility method to estimate transcription cost/time
  static estimateProcessingTime(audioBlob: AudioBlob): number {
    // Rough estimation: 1 second of audio = 0.1 seconds processing time
    const estimatedDuration = audioBlob.duration || (audioBlob.size / 32000) // Rough estimate
    return Math.max(estimatedDuration * 0.1, 1) // Minimum 1 second
  }
}

// Factory function for easy instantiation
export const createTranscriptionService = (apiClient: APIClient): TranscriptionService => {
  return new TranscriptionService(apiClient)
}
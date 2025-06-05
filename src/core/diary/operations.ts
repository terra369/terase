/**
 * Core diary operations
 * Shared between Web and Mobile platforms
 */

import { DiaryRepository, AudioRepository, createSupabaseClient } from '../api/supabase'
import type { Database } from '../types/database'

export interface DiaryEntry {
  id: number
  user_id: string
  date: string
  user_text?: string
  fairy_text?: string
  user_audio_url?: string
  fairy_audio_url?: string
  visibility: 'friends' | 'private'
  created_at: string
}

export interface DiaryMessage {
  id: number
  diary_id: number
  role: 'user' | 'ai'
  text: string
  audio_url?: string
  created_at: string
}

export interface CreateDiaryInput {
  date: string
  user_text?: string
  visibility?: 'friends' | 'private'
}

export interface SaveMessageInput {
  role: 'user' | 'ai'
  text: string
  audio_url?: string
}

export interface UpdateDiaryInput {
  user_text?: string
  fairy_text?: string
  user_audio_url?: string
  fairy_audio_url?: string
}

export class DiaryService {
  private diaryRepo: DiaryRepository
  private audioRepo: AudioRepository

  constructor(userId?: string) {
    const supabase = createSupabaseClient()
    this.diaryRepo = new DiaryRepository(supabase)
    this.audioRepo = new AudioRepository(supabase)
  }

  /**
   * Get today's diary entry for the user
   */
  async getTodayDiary(userId: string): Promise<DiaryEntry | null> {
    try {
      const diary = await this.diaryRepo.getTodayDiary(userId)
      return diary
    } catch (error) {
      console.error('Error getting today diary:', error)
      return null
    }
  }

  /**
   * Create a new diary entry
   */
  async createDiary(userId: string, input: CreateDiaryInput): Promise<DiaryEntry> {
    return await this.diaryRepo.createDiary(userId, {
      date: input.date,
      user_text: input.user_text,
      visibility: input.visibility || 'friends'
    })
  }

  /**
   * Get or create today's diary entry
   */
  async getOrCreateTodayDiary(userId: string): Promise<DiaryEntry> {
    const today = new Date().toISOString().split('T')[0]
    
    // Try to get existing diary
    let diary = await this.getTodayDiary(userId)
    
    if (!diary) {
      // Create new diary for today
      diary = await this.createDiary(userId, { date: today })
    }
    
    return diary
  }

  /**
   * Update an existing diary entry
   */
  async updateDiary(diaryId: number, updates: UpdateDiaryInput): Promise<DiaryEntry> {
    return await this.diaryRepo.updateDiary(diaryId, updates)
  }

  /**
   * Get all messages for a diary
   */
  async getDiaryMessages(diaryId: number): Promise<DiaryMessage[]> {
    return await this.diaryRepo.getDiaryMessages(diaryId)
  }

  /**
   * Save a new message to a diary
   */
  async saveMessage(diaryId: number, message: SaveMessageInput): Promise<DiaryMessage> {
    return await this.diaryRepo.saveMessage(diaryId, message)
  }

  /**
   * Upload audio file and get URL
   */
  async uploadAudio(audioBlob: Blob, fileName?: string): Promise<string> {
    const timestamp = Date.now()
    const finalFileName = fileName || `audio_${timestamp}.wav`
    
    return await this.audioRepo.uploadAudio(audioBlob, finalFileName)
  }

  /**
   * Save diary with audio transcription
   */
  async saveDiaryWithAudio(
    userId: string,
    text: string,
    audioBlob: Blob,
    date?: string
  ): Promise<{ diary: DiaryEntry; message: DiaryMessage }> {
    const diaryDate = date || new Date().toISOString().split('T')[0]
    
    // Upload audio first
    const audioUrl = await this.uploadAudio(audioBlob, `diary_${diaryDate}_${Date.now()}.wav`)
    
    // Get or create diary entry
    let diary = await this.getTodayDiary(userId)
    if (!diary) {
      diary = await this.createDiary(userId, { 
        date: diaryDate,
        user_text: text
      })
    } else {
      // Update existing diary with new text
      diary = await this.updateDiary(diary.id, { user_text: text })
    }
    
    // Save message with audio
    const message = await this.saveMessage(diary.id, {
      role: 'user',
      text,
      audio_url: audioUrl
    })
    
    return { diary, message }
  }

  /**
   * Save AI response to diary
   */
  async saveAIResponse(
    diaryId: number,
    text: string,
    audioUrl?: string
  ): Promise<{ diary: DiaryEntry; message: DiaryMessage }> {
    // Update diary with AI response
    const diary = await this.updateDiary(diaryId, { 
      fairy_text: text,
      fairy_audio_url: audioUrl
    })
    
    // Save AI message
    const message = await this.saveMessage(diaryId, {
      role: 'ai',
      text,
      audio_url: audioUrl
    })
    
    return { diary, message }
  }

  /**
   * Get conversation history for AI context
   */
  async getConversationHistory(diaryId: number): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.getDiaryMessages(diaryId)
    
    return messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.text
    }))
  }
}

// Utility functions for common operations
export const DiaryUtils = {
  /**
   * Create a formatted date string for today
   */
  getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
  },

  /**
   * Validate date string format
   */
  isValidDateString(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))
  },

  /**
   * Generate unique filename for audio
   */
  generateAudioFileName(prefix = 'audio', extension = 'wav'): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${prefix}_${timestamp}_${random}.${extension}`
  },

  /**
   * Format diary entry for display
   */
  formatDiaryForDisplay(diary: DiaryEntry): {
    date: string
    userText: string
    aiText: string
    hasAudio: boolean
  } {
    return {
      date: diary.date,
      userText: diary.user_text || '',
      aiText: diary.fairy_text || '',
      hasAudio: !!(diary.user_audio_url || diary.fairy_audio_url)
    }
  }
}
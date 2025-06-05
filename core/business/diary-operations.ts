/**
 * Platform-agnostic diary operations business logic
 * Core diary management for Web/React Native reusability
 */

import type { 
  Diary,
  DiaryMessage,
  SaveDiaryRequest,
  DiaryMessageRequest,
  ListDiariesRequest,
  APIResponse,
  DatabaseAdapter,
  StorageAdapter,
  AudioBlob,
} from '../api/types'

export interface DiaryOperationsOptions {
  autoSave?: boolean
  enableVersioning?: boolean
  maxMessagesPerDiary?: number
}

export interface CreateDiaryOptions {
  visibility?: 'friends' | 'private'
  autoUploadAudio?: boolean
}

export interface DiaryWithMessages extends Diary {
  messages: DiaryMessage[]
}

export class DiaryOperations {
  private database: DatabaseAdapter
  private storage: StorageAdapter
  private options: DiaryOperationsOptions

  constructor(
    database: DatabaseAdapter,
    storage: StorageAdapter,
    options: DiaryOperationsOptions = {}
  ) {
    this.database = database
    this.storage = storage
    this.options = {
      autoSave: true,
      enableVersioning: false,
      maxMessagesPerDiary: 50,
      ...options,
    }
  }

  async createDiary(
    date: string,
    userText: string,
    userAudio?: AudioBlob,
    options: CreateDiaryOptions = {}
  ): Promise<APIResponse<Diary>> {
    try {
      // Upload audio if provided
      let userAudioUrl: string | undefined
      if (userAudio && options.autoUploadAudio !== false) {
        const audioPath = this.generateAudioPath(date, 'user')
        userAudioUrl = await this.storage.uploadAudio(userAudio, audioPath)
      }

      // Create diary entry
      const diaryData: SaveDiaryRequest = {
        date,
        userText,
        userAudioUrl,
        visibility: options.visibility || 'friends',
      }

      const result = await this.database.saveDiary(diaryData)
      
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '日記の作成に失敗しました',
      }
    }
  }

  async getDiary(date: string): Promise<APIResponse<Diary>> {
    try {
      const diary = await this.database.getDiary(date)
      
      if (!diary) {
        return {
          success: false,
          error: '指定された日付の日記が見つかりません',
        }
      }

      return {
        success: true,
        data: diary,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '日記の取得に失敗しました',
      }
    }
  }

  async getDiaryWithMessages(date: string): Promise<APIResponse<DiaryWithMessages>> {
    try {
      const diaryResult = await this.getDiary(date)
      if (!diaryResult.success || !diaryResult.data) {
        return {
          success: false,
          error: diaryResult.error || '日記の取得に失敗しました',
        }
      }

      const messages = await this.database.getMessages(diaryResult.data.id)
      
      const diaryWithMessages: DiaryWithMessages = {
        ...diaryResult.data,
        messages,
      }

      return {
        success: true,
        data: diaryWithMessages,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '日記とメッセージの取得に失敗しました',
      }
    }
  }

  async listDiaries(options: ListDiariesRequest = {}): Promise<APIResponse<Diary[]>> {
    try {
      const diaries = await this.database.listDiaries(options)
      
      return {
        success: true,
        data: diaries,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '日記一覧の取得に失敗しました',
      }
    }
  }

  async addMessage(
    diaryId: number,
    role: 'user' | 'ai',
    text: string,
    audioBlob?: AudioBlob
  ): Promise<APIResponse<DiaryMessage>> {
    try {
      // Check message limit
      const existingMessages = await this.database.getMessages(diaryId)
      if (existingMessages.length >= this.options.maxMessagesPerDiary!) {
        return {
          success: false,
          error: 'メッセージ数の上限に達しました',
        }
      }

      // Upload audio if provided
      let audioUrl: string | undefined
      if (audioBlob) {
        const audioPath = this.generateMessageAudioPath(diaryId, role, existingMessages.length)
        audioUrl = await this.storage.uploadAudio(audioBlob, audioPath)
      }

      // Save message
      const messageData: DiaryMessageRequest = {
        diaryId,
        role,
        text,
        audioUrl,
      }

      const result = await this.database.saveMessage(messageData)
      
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'メッセージの追加に失敗しました',
      }
    }
  }

  async updateDiaryVisibility(
    date: string,
    visibility: 'friends' | 'private'
  ): Promise<APIResponse<Diary>> {
    try {
      // Get existing diary
      const diaryResult = await this.getDiary(date)
      if (!diaryResult.success || !diaryResult.data) {
        return {
          success: false,
          error: '日記が見つかりません',
        }
      }

      // Update with new visibility
      const updatedDiaryData: SaveDiaryRequest = {
        date,
        userText: diaryResult.data.userText,
        userAudioUrl: diaryResult.data.userAudioUrl || undefined,
        visibility,
      }

      const result = await this.database.saveDiary(updatedDiaryData)
      
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '公開設定の更新に失敗しました',
      }
    }
  }

  async deleteDiaryAudio(date: string): Promise<APIResponse<void>> {
    try {
      const diaryResult = await this.getDiary(date)
      if (!diaryResult.success || !diaryResult.data) {
        return {
          success: false,
          error: '日記が見つかりません',
        }
      }

      const diary = diaryResult.data

      // Delete audio files
      const deletePromises: Promise<void>[] = []
      
      if (diary.userAudioUrl) {
        const userAudioPath = this.extractPathFromUrl(diary.userAudioUrl)
        deletePromises.push(this.storage.deleteAudio(userAudioPath))
      }

      if (diary.fairyAudioUrl) {
        const fairyAudioPath = this.extractPathFromUrl(diary.fairyAudioUrl)
        deletePromises.push(this.storage.deleteAudio(fairyAudioPath))
      }

      await Promise.all(deletePromises)

      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '音声ファイルの削除に失敗しました',
      }
    }
  }

  async getDiaryStatistics(year?: number, month?: number): Promise<APIResponse<{
    totalDiaries: number
    averageLength: number
    longestStreak: number
    currentStreak: number
    monthlyBreakdown: Record<string, number>
  }>> {
    try {
      const diaries = await this.database.listDiaries({
        year,
        month,
        limit: 1000, // Get all for statistics
      })

      const stats = this.calculateDiaryStatistics(diaries)
      
      return {
        success: true,
        data: stats,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '統計の計算に失敗しました',
      }
    }
  }

  private generateAudioPath(date: string, role: 'user' | 'fairy'): string {
    const userId = 'user' // This would come from auth context in real implementation
    return `diaries/${userId}/${date}/${role}_audio`
  }

  private generateMessageAudioPath(diaryId: number, role: 'user' | 'ai', messageIndex: number): string {
    const userId = 'user' // This would come from auth context in real implementation
    return `diaries/${userId}/messages/${diaryId}/${role}_${messageIndex}`
  }

  private extractPathFromUrl(url: string): string {
    // Extract path from full URL - implementation would depend on storage provider
    const urlParts = url.split('/')
    return urlParts.slice(-3).join('/') // Last 3 parts typically contain the path
  }

  private calculateDiaryStatistics(diaries: Diary[]): {
    totalDiaries: number
    averageLength: number
    longestStreak: number
    currentStreak: number
    monthlyBreakdown: Record<string, number>
  } {
    const totalDiaries = diaries.length
    const averageLength = diaries.reduce((sum, diary) => sum + diary.userText.length, 0) / totalDiaries || 0

    // Calculate streaks
    const sortedDates = diaries
      .map(d => new Date(d.date))
      .sort((a, b) => a.getTime() - b.getTime())

    let longestStreak = 0
    let currentStreakValue = 0
    let tempStreak = 1

    for (let i = 1; i < sortedDates.length; i++) {
      const diffDays = Math.floor(
        (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      )

      if (diffDays === 1) {
        tempStreak++
      } else {
        longestStreak = Math.max(longestStreak, tempStreak)
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)

    // Calculate current streak (from today backwards)
    const today = new Date()
    const recentDates = sortedDates.reverse()
    
    for (let i = 0; i < recentDates.length; i++) {
      const diffDays = Math.floor(
        (today.getTime() - recentDates[i].getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (diffDays === i) {
        currentStreakValue++
      } else {
        break
      }
    }

    // Monthly breakdown
    const monthlyBreakdown: Record<string, number> = {}
    diaries.forEach(diary => {
      const month = diary.date.substring(0, 7) // YYYY-MM format
      monthlyBreakdown[month] = (monthlyBreakdown[month] || 0) + 1
    })

    return {
      totalDiaries,
      averageLength: Math.round(averageLength),
      longestStreak,
      currentStreak: currentStreakValue,
      monthlyBreakdown,
    }
  }

  // Utility methods
  getTodaysDate(): string {
    return new Date().toISOString().split('T')[0]
  }

  isToday(date: string): boolean {
    return date === this.getTodaysDate()
  }

  isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    return dateRegex.test(date) && !isNaN(Date.parse(date))
  }
}

// Factory function for creating diary operations instances
export const createDiaryOperations = (
  database: DatabaseAdapter,
  storage: StorageAdapter,
  options?: DiaryOperationsOptions
): DiaryOperations => {
  return new DiaryOperations(database, storage, options)
}
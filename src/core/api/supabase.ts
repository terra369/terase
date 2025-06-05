/**
 * Core Supabase operations module
 * Shared between Web and Mobile platforms
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// Create a platform-agnostic Supabase client factory
export function createSupabaseClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Diary database operations
 */
export class DiaryRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getTodayDiary(userId: string) {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await this.supabase
      .from('diaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data
  }

  async createDiary(userId: string, data: {
    date: string
    user_text?: string
    visibility?: 'friends' | 'private'
  }) {
    const { data: diary, error } = await this.supabase
      .from('diaries')
      .insert({
        user_id: userId,
        ...data
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return diary
  }

  async updateDiary(diaryId: number, updates: {
    user_text?: string
    fairy_text?: string
    user_audio_url?: string
    fairy_audio_url?: string
  }) {
    const { data, error } = await this.supabase
      .from('diaries')
      .update(updates)
      .eq('id', diaryId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  async getDiaryMessages(diaryId: number) {
    const { data, error } = await this.supabase
      .from('diary_messages')
      .select('*')
      .eq('diary_id', diaryId)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return data
  }

  async saveMessage(diaryId: number, message: {
    role: 'user' | 'ai'
    text: string
    audio_url?: string
  }) {
    const { data, error } = await this.supabase
      .from('diary_messages')
      .insert({
        diary_id: diaryId,
        ...message
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }
}

/**
 * Audio storage operations
 */
export class AudioRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async uploadAudio(audioBlob: Blob, fileName: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('private_audio')
      .upload(fileName, audioBlob, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from('private_audio')
      .getPublicUrl(data.path)

    return publicUrl
  }

  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('private_audio')
      .createSignedUrl(path, 3600)

    if (error) {
      throw error
    }

    return data.signedUrl
  }
}

/**
 * Authentication operations
 */
export class AuthRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    
    if (error) {
      throw error
    }

    return user
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut()
    
    if (error) {
      throw error
    }
  }
}
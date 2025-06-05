/**
 * Core database type definitions
 * Shared between Web and Mobile platforms
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          fairy_name: string | null
          fairy_img_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          fairy_name?: string | null
          fairy_img_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          fairy_name?: string | null
          fairy_img_url?: string | null
          created_at?: string
        }
      }
      diaries: {
        Row: {
          id: number
          user_id: string
          date: string
          user_text: string | null
          fairy_text: string | null
          user_audio_url: string | null
          fairy_audio_url: string | null
          visibility: 'friends' | 'private'
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          date: string
          user_text?: string | null
          fairy_text?: string | null
          user_audio_url?: string | null
          fairy_audio_url?: string | null
          visibility?: 'friends' | 'private'
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          date?: string
          user_text?: string | null
          fairy_text?: string | null
          user_audio_url?: string | null
          fairy_audio_url?: string | null
          visibility?: 'friends' | 'private'
          created_at?: string
        }
      }
      diary_messages: {
        Row: {
          id: number
          diary_id: number
          role: 'user' | 'ai'
          text: string
          audio_url: string | null
          created_at: string
        }
        Insert: {
          id?: number
          diary_id: number
          role: 'user' | 'ai'
          text: string
          audio_url?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          diary_id?: number
          role?: 'user' | 'ai'
          text?: string
          audio_url?: string | null
          created_at?: string
        }
      }
      friends: {
        Row: {
          user_id: string
          friend_user_id: string
          status: 'pending' | 'accepted'
          created_at: string
        }
        Insert: {
          user_id: string
          friend_user_id: string
          status?: 'pending' | 'accepted'
          created_at?: string
        }
        Update: {
          user_id?: string
          friend_user_id?: string
          status?: 'pending' | 'accepted'
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
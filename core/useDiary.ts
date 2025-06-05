import { z } from 'zod';
import type { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';

// Diary creation input schema
const diaryInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().min(1),
  audioPath: z.string().min(1),
});

export type DiaryInput = z.infer<typeof diaryInputSchema>;

// Message creation input schema
const messageInputSchema = z.object({
  diaryId: z.number(),
  role: z.enum(['user', 'ai']),
  text: z.string().min(1),
  audioUrl: z.string().optional(),
  triggerAI: z.boolean().optional().default(false),
});

export type MessageInput = z.infer<typeof messageInputSchema>;

// Use the actual Supabase client type
type SupabaseClient = SupabaseClientType<any, 'public', any>;

/**
 * 共通日記管理関数
 * Web/React Native 両対応の統一インターフェース
 */
export class DiaryService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * 日記エントリを作成または更新する
   * @param input 日記入力データ
   * @returns 作成された日記のID
   */
  async createDiary(input: DiaryInput): Promise<number> {
    // 入力検証
    const parsed = diaryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    // ユーザー認証確認
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // 日記エントリの作成/更新
    const { data, error } = await this.supabase
      .from('diaries')
      .upsert(
        { user_id: user.id, date: input.date },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create diary entry');
    }

    const diaryId = data.id;

    // 初期ユーザーメッセージを作成
    const { error: messageError } = await this.supabase
      .from('diary_messages')
      .insert({
        diary_id: diaryId,
        role: 'user',
        text: input.text,
        audio_url: input.audioPath,
      });

    if (messageError) {
      throw messageError;
    }

    return diaryId;
  }

  /**
   * 既存の日記にメッセージを追加する
   * @param input メッセージ入力データ
   * @param options オプション（プラットフォーム固有の機能用）
   */
  async addMessageToDiary(input: MessageInput, options?: { useAPI?: boolean }): Promise<void> {
    // 入力検証
    const parsed = messageInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    // ユーザー認証確認
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // WebプラットフォームでtriggerAI機能が必要な場合はAPIを使用
    if (options?.useAPI && input.triggerAI && typeof window !== 'undefined') {
      const response = await fetch('/api/diaries/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          diaryId: input.diaryId,
          role: input.role,
          text: input.text,
          audioUrl: input.audioUrl || null,
          triggerAI: input.triggerAI
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to save message: ${errorBody}`);
      }
      return;
    }

    // 直接データベースに挿入（React Native等）
    const { error } = await this.supabase
      .from('diary_messages')
      .insert({
        diary_id: input.diaryId,
        role: input.role,
        text: input.text,
        audio_url: input.audioUrl || null,
      });

    if (error) {
      throw error;
    }
  }

  /**
   * 今日の日記を確保する（存在しない場合は作成）
   * @param text 初期テキスト
   * @param audioPath 音声ファイルパス
   * @returns 日記ID
   */
  async ensureTodayDiary(text: string, audioPath: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    
    return this.createDiary({
      date: today,
      text,
      audioPath,
    });
  }
}

/**
 * 統一日記管理フック（React用）
 * プラットフォーム固有のSupabaseクライアントを受け取る
 */
export function useDiary(supabase: SupabaseClient) {
  const diaryService = new DiaryService(supabase);

  return {
    createDiary: diaryService.createDiary.bind(diaryService),
    addMessageToDiary: (input: MessageInput, options?: { useAPI?: boolean }) => 
      diaryService.addMessageToDiary(input, options),
    ensureTodayDiary: diaryService.ensureTodayDiary.bind(diaryService),
  };
}

/**
 * レガシー互換性のための型定義とユーティリティ
 */
export { diaryInputSchema, messageInputSchema };

// FormData からの DiaryInput 変換ユーティリティ
export function parseDiaryFromFormData(formData: FormData): DiaryInput {
  return diaryInputSchema.parse({
    date: formData.get('date'),
    text: formData.get('text'),
    audioPath: formData.get('audioPath'),
  });
}

// JSON からの MessageInput 変換ユーティリティ
export function parseMessageFromJSON(json: any): MessageInput {
  return messageInputSchema.parse(json);
}
'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

/**
 * diary_messages テーブルの INSERT を購読し、新着メッセージをコールバックへ渡す。
 *
 * @param diaryId  - diaries.id（1 つの日記スレッドを指定）
 * @param onInsert - (newRow) => void  を呼び出すコールバック
 */
export function useDiaryRealtime<T extends { [key: string]: unknown }>(
  diaryId: number,
  onInsert: (row: T) => void,
) {
  useEffect(() => {
    /* ------------- Supabase Realtime ------------- */
    const channel = supabaseBrowser
      .channel(`diary-${diaryId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'diary_messages',
          filter: `diary_id=eq.${diaryId}`,
        },
        (payload) => {
          // payload.new が新しいレコード
          onInsert(payload.new as T);
        },
      )
      .subscribe();

    /* ------------- クリーンアップ ------------- */
    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [diaryId, onInsert]);
}
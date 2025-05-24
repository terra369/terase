import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function useTodayDiary() {
  const [diaryId, setDiaryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTodayDiary = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (!user) {
          throw new Error('ユーザーが認証されていません');
        }

        const today = new Date().toISOString().slice(0, 10);
        
        // 今日の日記を取得
        const { data, error: fetchError } = await supabaseBrowser
          .from('diaries')
          .select('id')
          .eq('date', today)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 is "not found" error, which is expected if no diary exists yet
          throw fetchError;
        }

        if (data) {
          setDiaryId(data.id);
        } else {
          // No diary exists for today yet
          setDiaryId(null);
        }
      } catch (err) {
        console.error('Error fetching today diary:', err);
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchTodayDiary();
  }, []);

  return { diaryId, loading, error };
}
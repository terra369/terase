import { useEffect } from 'react';
import { useDiary } from '@/core/hooks/useDiary';

export function useTodayDiary() {
  const { diary, isLoading, error, getTodayDiary } = useDiary();

  useEffect(() => {
    getTodayDiary();
  }, [getTodayDiary]);

  return { 
    diaryId: diary?.id || null, 
    loading: isLoading, 
    error 
  };
}
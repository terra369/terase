'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { DiaryService, parseDiaryFromFormData } from '@core/useDiary';

export async function saveDiary(
  _prev: unknown,
  fd: FormData,
): Promise<number> {
  // Parse FormData using shared utility
  const input = parseDiaryFromFormData(fd);

  // Use shared diary service
  const supabase = await supabaseServer();
  const diaryService = new DiaryService(supabase);
  
  return diaryService.createDiary(input);
}
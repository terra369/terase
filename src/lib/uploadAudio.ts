import { supabaseBrowser } from './supabaseBrowser'

export async function uploadAudio(file: Blob, userId: string) {
  const path = `${userId}/${Date.now()}.webm`
  const { data, error } = await supabaseBrowser.storage
    .from('diary-audio')
    .upload(path, file, { upsert: false })

  if (error) throw error
  // 署名付き URL を返す
  const { data: url } = supabaseBrowser.storage
    .from('diary-audio')
    .getPublicUrl(data.path)
  return url.publicUrl
}
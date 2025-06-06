import type { SupabaseClient } from '@supabase/supabase-js';

// Get file extension from MIME type
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm;codecs=opus': 'webm'
  }
  
  return mimeToExt[mimeType] || 'webm'
}

export async function uploadAudio(
  blob: Blob,
  userId: string,
  supabase: SupabaseClient
) {
  const fileExtension = getFileExtension(blob.type)
  const path = `${userId}/${Date.now()}.${fileExtension}`;

  /* 1) 署名付き URL + token */
  const { data: up, error: upErr } =
    await supabase.storage.from('diary-audio').createSignedUploadUrl(path);

  console.log('createSignedUploadUrl →', { up, upErr });

  if (upErr || !up) throw upErr ?? new Error('signed upload URL 取得失敗');

  /* 2) アップロード */
  const { data: putData, error: putErr } =
    await supabase.storage
      .from('diary-audio')
      .uploadToSignedUrl(up.path, up.token, blob, {
        contentType: blob.type || 'audio/webm',
      });

  console.log('uploadToSignedUrl →', { putData, putErr });

  if (putErr) throw putErr;

  /* 3) ダウンロード用 URL 生成 */
  const { data: dl, error: dlErr } =
    await supabase.storage.from('diary-audio').createSignedUrl(path, 60);

  console.log('createSignedUrl →', { dl, dlErr });

  if (dlErr || !dl) throw dlErr ?? new Error('signed DL URL 生成失敗');

  return { path, signedUrl: dl.signedUrl };
}
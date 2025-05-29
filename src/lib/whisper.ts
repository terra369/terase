import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribe(fileUrl: string) {
  const res = await fetch(fileUrl)
  const blob = await res.blob()
  
  // Get the content type from the response or blob
  const contentType = res.headers.get('content-type') || blob.type || 'audio/webm'
  
  // Get appropriate file extension
  const getExtension = (mimeType: string): string => {
    const mimeToExt: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/webm;codecs=opus': 'webm'
    }
    return mimeToExt[mimeType] || 'webm'
  }
  
  const extension = getExtension(contentType)
  const file = new File([blob], `voice.${extension}`, { type: contentType })

  const { text } = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'ja'
  })
  return text as string
}
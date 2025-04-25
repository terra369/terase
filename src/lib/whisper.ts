import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribe(fileUrl: string) {
  const res = await fetch(fileUrl)
  const blob = await res.blob()
  const file = new File([blob], 'voice.webm', { type: 'audio/webm' })

  const { text } = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'ja'
  })
  return text as string
}
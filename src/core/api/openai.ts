/**
 * Core OpenAI API integration module
 * Shared between Web and Mobile platforms
 */

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

/**
 * Transcribe audio using OpenAI Whisper
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.wav')
  formData.append('model', 'whisper-1')
  formData.append('language', 'ja')

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioBlob as any,
      model: 'whisper-1',
      language: 'ja',
    })
    return transcription.text
  } catch (error) {
    console.error('Transcription error:', error)
    throw new Error('音声の文字起こしに失敗しました')
  }
}

/**
 * Generate AI chat response
 */
export async function generateAIResponse(
  messages: ChatCompletionMessageParam[],
  systemPrompt?: string
): Promise<string> {
  try {
    const systemMessage: ChatCompletionMessageParam = {
      role: 'system',
      content: systemPrompt || 'あなたは優しくて共感的なAIアシスタントです。'
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    })

    return completion.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('AI response error:', error)
    throw new Error('AI応答の生成に失敗しました')
  }
}

/**
 * Generate text-to-speech audio
 */
export async function generateTTS(text: string): Promise<ArrayBuffer> {
  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
      speed: 1.0,
    })

    return response.arrayBuffer()
  } catch (error) {
    console.error('TTS error:', error)
    throw new Error('音声生成に失敗しました')
  }
}

export type { ChatCompletionMessageParam }
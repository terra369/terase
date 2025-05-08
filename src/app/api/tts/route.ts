import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// サーバーサイドのみで実行される
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      input: text,
      voice: "shimmer",
      response_format: "mp3",
    });
    
    // オーディオストリームを取得
    const arrayBuffer = await audioResponse.arrayBuffer();
    
    // レスポンスを返す
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error in TTS API:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}

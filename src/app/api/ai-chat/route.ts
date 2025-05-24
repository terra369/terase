import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseServer } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // 認証確認
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, context } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // AI応答を生成
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたは感情豊かで親しみやすいAIアシスタントです。ユーザーとリアルタイムで対話しているような自然な会話を心がけてください。

特徴：
- 日本語で応答する
- 親しみやすく、温かい口調
- 簡潔で分かりやすい回答（1-3文程度）
- ユーザーの感情に寄り添う
- 質問や感想には積極的に反応する

現在は音声による対話セッション中です。自然な会話を楽しみましょう。`
        },
        ...(context || []),
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 150,
      temperature: 0.8
    });

    const aiResponse = completion.choices[0]?.message?.content || "すみません、よく聞こえませんでした。";

    return NextResponse.json({ 
      response: aiResponse,
      usage: completion.usage 
    });

  } catch (error) {
    console.error('Error in AI chat API:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
}
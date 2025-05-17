import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts";

// 型定義
interface SignedUrl {
  path: string;
  token: string;
  data?: {
    url: string;
  };
}

interface AudioResult {
  audioUrl: string | null;
  error: string | null;
}

interface UserMessage {
  text: string;
  role: string;
}

interface DiaryRecord {
  diary_id: number;
  role: string;
  text: string;
}

/* ─── 環境変数 ──────────────────────────────────────── */
const SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET_NAME = "diary-audio";
const STORAGE_BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`;


/* ─── クライアント初期化 ───────────────────────────────── */
const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * 管理者権限を持つSupabaseクライアントを作成する関数
 */
function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { 
    auth: { persistSession: false } 
  });
}

/**
 * 署名付きURLを使用して音声をSupabase Storageにアップロードする関数
 */
async function uploadAudio(buf: Uint8Array, signedUrl: SignedUrl): Promise<string> {
  try {
    console.log("音声ファイルを署名付きURLにアップロード開始");
    const put = await supabase.storage
      .from(BUCKET_NAME)
      .uploadToSignedUrl(signedUrl.path, signedUrl.token, buf, {
        contentType: "audio/mpeg",
      });

    if (put.error) {
      console.error("アップロードエラー:", put.error);
      throw put.error;
    }

    console.log("アップロード成功: ", signedUrl.path);
    return signedUrl.path;
  } catch (e) {
    console.error("uploadAudio エラー:", e instanceof Error ? e.message : String(e));
    throw e;
  }
}

/**
 * OpenAI TTS APIを使用してテキストから音声を生成する関数
 */
async function generateAudio(text: string): Promise<Uint8Array | null> {
  try {
    console.log("高品質音声生成開始");

    // OpenAI TTS APIを使用して音声生成
    const speechResponse = await openai.audio.speech.create({
      model: "tts-1-hd", // 高品質モデル
      voice: "shimmer", // クリアで温かみのある声
      input: text,
      response_format: "mp3",
      speed: 1.0,
    });

    // 音声バイナリを取得して返却
    const audioBuffer = await speechResponse.arrayBuffer();
    console.log("音声生成完了: ", audioBuffer.byteLength, "bytes");
    return new Uint8Array(audioBuffer);
  } catch (e) {
    console.error("音声生成エラー:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * 音声ファイルをSupabase Storageにアップロードする関数
 */
async function uploadAudioToStorage(supabaseClient: SupabaseClient, diaryId: number, audioData: Uint8Array): Promise<string | null> {
  try {
    // ファイル名を生成
    const audioFileName = `ai/${diaryId}/${Date.now()}.mp3`;
    console.log("ストレージへのアップロード開始: ", audioFileName);

    // Supabaseストレージにアップロード
    const { error: uploadError } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(audioFileName, audioData, {
        contentType: "audio/mpeg",
        cacheControl: "3600"
      });

    if (uploadError) {
      console.error("アップロードエラー:", uploadError);
      return null;
    }

    // アップロードしたファイルの公開URLを取得
    const { data: urlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(audioFileName);

    if (!urlData || !urlData.publicUrl) {
      console.error("公開URLの取得に失敗");
      return null;
    }

    console.log("アップロード完了: ", urlData.publicUrl);
    return urlData.publicUrl;
  } catch (e) {
    console.error("アップロード処理エラー:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * 音声生成とアップロードを行う関数
 * 高品質なテキスト読み上げを使用
 */
async function generateAndUploadAudio(supabaseClient: SupabaseClient, diaryId: number, text: string): Promise<AudioResult> {
  // 入力チェック
  if (!text || !diaryId) {
    return { audioUrl: null, error: "音声生成に必要なパラメータが不足しています" };
  }

  try {
    // テキストから音声を生成
    const audioData = await generateAudio(text);
    if (!audioData) {
      return { audioUrl: null, error: "音声生成に失敗しました" };
    }

    // 音声をストレージにアップロード
    const audioUrl = await uploadAudioToStorage(supabaseClient, diaryId, audioData);
    if (!audioUrl) {
      return { audioUrl: null, error: "音声ファイルのアップロードに失敗しました" };
    }

    return { audioUrl, error: null };
  } catch (e) {
    console.error("音声生成処理エラー:", e instanceof Error ? e.message : String(e));
    return { audioUrl: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 会話履歴から最新のメッセージを取得する関数
 */
async function fetchConversationHistory(client: SupabaseClient, diaryId: number): Promise<{ messages: Array<{role: string, content: string}> | null, error: string | null }> {
  try {
    console.log(`日記ID ${diaryId} の会話履歴を取得中...`);

    const { data: messages, error } = await client
      .from("diary_messages")
      .select("text, role")
      .eq("diary_id", diaryId)
      .order("created_at", { ascending: false })
      .limit(5); // 最新の5件を取得

    if (error) {
      console.error(`会話履歴取得エラー:`, error);
      return { messages: null, error: "メッセージ履歴の取得に失敗しました" };
    }

    // OpenAI API用にフォーマットし、古い順に並び替え
    const formattedMessages = messages
      ? messages
          .map(msg => ({
            // データベースの 'ai' ロールをOpenAI APIの 'assistant' ロールに変換
            role: msg.role === 'ai' ? 'assistant' : msg.role,
            content: msg.text
          }))
          .reverse() // 時系列順に並び替え
      : [];

    console.log(`合計${formattedMessages.length}件のメッセージを取得しました`);
    return { messages: formattedMessages, error: null };
  } catch (e) {
    console.error(`会話履歴取得中の予期せぬエラー:`, e instanceof Error ? e.message : String(e));
    return { messages: null, error: `会話履歴取得エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * AIテキスト返答を生成する関数
 */
async function generateAITextReply(userMessage: string, conversationHistory: Array<{role: string, content: string}> = []): Promise<{ text: string | null, error: string | null }> {
  try {
    console.log(`高品質モデルでAI返答を生成中...`);

    // システムプロンプトの定義
    const systemPrompt = {
      role: "system",
      content: `あなたは感謝日記をサポートするコーチです。
ユーザーの発言内容を深く理解し、共感と洞察に満ちた温かい返答を心がけてください。
ユーザーの成長や気づきを促し、良い点を強調しつつ、さらなる視点を提供してください。`
    };

    // AI応答を生成
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o", // 高品質モデル
      messages: [
        systemPrompt,
        ...conversationHistory,
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    // 結果を取得して返却
    const replyText = aiResponse.choices[0].message.content.trim();
    if (!replyText) {
      return { text: null, error: "AIから空の返答が返されました" };
    }

    console.log(`AI返答生成完了: ${replyText.substring(0, 30)}...`);
    return { text: replyText, error: null };
  } catch (e) {
    console.error(`AI返答生成エラー:`, e instanceof Error ? e.message : String(e));
    return { text: null, error: `AI返答生成エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── メイン処理 ─────────────────────────────────────── */
serve(async (req, ctx) => {
  try {
    // リクエストのパースとバリデーション
    const { record } = await req.json() as { record: DiaryRecord };
    if (!record || record.role !== "user") {
      console.log(`ユーザーメッセージではないレコードを無視しました`);
      return new Response("ignore");
    }

    // 管理者権限を持つSupabaseクライアントを作成
    const supabaseClientAdmin = createAdminClient();
    const diaryId = record.diary_id;

    // 会話履歴を取得
    const { messages: conversationHistory, error: historyError } = await fetchConversationHistory(supabaseClientAdmin, diaryId);
    if (historyError) {
      return new Response(JSON.stringify({ error: historyError }), { status: 500 });
    }

    // AIテキスト返答を生成
    const { text: aiTextReply, error: aiError } = await generateAITextReply(record.text, conversationHistory || []);
    if (aiError) {
      return new Response(JSON.stringify({ error: aiError }), { status: 500 });
    }
    if (!aiTextReply) {
      console.error(`AI返答が空です`);
      return new Response(JSON.stringify({ error: "AI返答が空です" }), { status: 500 });
    }

    // 高品質な音声を生成してアップロード
    console.log(`テキストを高品質音声に変換中...`);
    const { audioUrl: highQualityAudioUrl, error: audioError } = await generateAndUploadAudio(
      supabaseClientAdmin,
      diaryId,
      aiTextReply
    );

    if (audioError) {
      console.error(`音声生成またはアップロードエラー:`, audioError);
      return new Response(JSON.stringify({ error: `音声ファイルの処理に失敗しました: ${audioError}` }), { status: 500 });
    }
    if (!highQualityAudioUrl) {
      console.error(`音声URLが取得できませんでした`);
      return new Response(JSON.stringify({ error: `音声URLが取得できませんでした` }), { status: 500 });
    }
    console.log(`公開音声URL生成完了: ${highQualityAudioUrl.substring(0, 80)}...`);

    // 公開URLからパスを抽出し、署名付きURLを生成
    let signedAudioUrl = highQualityAudioUrl;
    try {
      const audioPathInBucket = extractPathFromUrl(highQualityAudioUrl);
      const { data: signedUrlData, error: signError } = await supabaseClientAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrl(audioPathInBucket, 3600);

      if (signError) {
        console.error(`署名付きURLの生成に失敗しました:`, signError);
      } else if (signedUrlData?.signedUrl) {
        signedAudioUrl = signedUrlData.signedUrl;
        console.log(`署名付き音声URL生成完了: ${signedAudioUrl.substring(0, 80)}...`);
      } else {
        console.warn("署名付きURLのデータが不正です。");
      }
    } catch (e) {
      console.error("署名付きURL生成中に予期せぬエラー:", e);
    }

    // 音声ファイルの所有者を設定 (元々公開URLを期待していたので highQualityAudioUrl を使用)
    const { success: ownershipSuccess, error: ownershipError } = await setAudioFileOwnership(supabaseClientAdmin, diaryId, highQualityAudioUrl);
    if (!ownershipSuccess) {
      return new Response(JSON.stringify({ error: ownershipError }), { status: 500 });
    }

    // AIメッセージをデータベースに保存
    const { message: savedMessage, error: saveError } = await saveAIMessage(supabaseClientAdmin, {
      diaryId,
      text: aiTextReply,
      audioUrl: signedAudioUrl
    });

    if (saveError) {
      return new Response(JSON.stringify({ error: saveError }), { status: 500 });
    }

    // 成功したレスポンスを返す
    return new Response(JSON.stringify(savedMessage), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error(`AI返答処理中の予期せぬエラー:`, e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: `予期せぬエラーが発生しました: ${e instanceof Error ? e.message : String(e)}` }), { status: 500 });
  }
});

/**
 * URLからバケット内のパスを抽出する関数
 */
function extractPathFromUrl(url: string): string {
  try {
    // 最も直接的な方法: URLがベースURLで始まる場合
    if (url.startsWith(STORAGE_BASE_URL)) {
      return url.substring(STORAGE_BASE_URL.length);
    }

    // 代替方法: URLパスからバケット名とそれ以降の部分を抽出
    const urlObject = new URL(url);
    const pathSegments = urlObject.pathname.split('/');
    const bucketNameIndex = pathSegments.indexOf(BUCKET_NAME);

    if (bucketNameIndex !== -1 && bucketNameIndex + 1 < pathSegments.length) {
      return pathSegments.slice(bucketNameIndex + 1).join('/');
    }

    throw new Error(`URLからパスを抽出できませんでした: ${url}`);
  } catch (e) {
    console.error(`URL解析エラー:`, e instanceof Error ? e.message : String(e));
    throw new Error(`URL解析エラー: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * 音声ファイルの所有者を日記のユーザーに設定する関数
 */
async function setAudioFileOwnership(client: SupabaseClient, diaryId: number, audioUrl: string): Promise<{success: boolean, error: string | null}> {
  try {
    console.log(`音声ファイルの所有者を設定中...`);

    // URLからバケット内のパスを抽出
    const audioPathInBucket = extractPathFromUrl(audioUrl);
    console.log(`抽出されたパス: ${audioPathInBucket}`);

    // 日記の所有者を取得
    const { data: diaryData, error: diaryError } = await client
      .from("diaries")
      .select("user_id")
      .eq("id", diaryId)
      .single();

    if (diaryError) {
      console.error(`日記所有者取得エラー:`, diaryError);
      return { success: false, error: `日記の所有者情報の取得に失敗しました: ${diaryError.message}` };
    }

    if (!diaryData || !diaryData.user_id) {
      return { success: false, error: `日記ID ${diaryId} の所有者が見つかりません` };
    }

    // 所有者を設定
    const { error: ownErr } = await client.rpc("set_storage_owner", {
      p_bucket: BUCKET_NAME,
      p_name: audioPathInBucket,
      p_owner: diaryData.user_id,
    });

    if (ownErr) {
      console.error(`所有者設定エラー:`, ownErr);
      return { success: false, error: `音声ファイルの所有者設定に失敗しました: ${ownErr.message}` };
    }

    console.log(`音声ファイルの所有者設定が完了しました: ${audioPathInBucket}`);
    return { success: true, error: null };
  } catch (e) {
    console.error(`所有者設定中のエラー:`, e instanceof Error ? e.message : String(e));
    return { success: false, error: `所有者設定エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}

interface AIMessageData {
  diaryId: number;
  text: string;
  audioUrl: string;
}

/**
 * AIメッセージをデータベースに保存する関数
 */
async function saveAIMessage(client: SupabaseClient, data: AIMessageData): Promise<{ message: any, error: string | null }> {
  try {
    console.log(`AIメッセージをデータベースに保存中...`);

    // データベースに保存
    const { data: newMessage, error: insertError } = await client
      .from("diary_messages")
      .insert({
        diary_id: data.diaryId,
        role: "ai",
        text: data.text,
        audio_url: data.audioUrl,
      })
      .select("id, text, audio_url, created_at, role, diary_id")
      .single();

    if (insertError) {
      console.error(`メッセージ保存エラー:`, insertError);
      return { message: null, error: `AIメッセージの保存に失敗しました: ${insertError.message}` };
    }

    console.log(`AIメッセージを正常に保存しました ID: ${newMessage.id}`);

    // 即座にメッセージを返す
    return { message: newMessage, error: null };
  } catch (e) {
    console.error(`メッセージ保存中のエラー:`, e instanceof Error ? e.message : String(e));
    return { message: null, error: `メッセージ保存エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}
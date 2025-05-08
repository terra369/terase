import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts";

/* ─── Env ──────────────────────────────────────────────── */
const supabaseUrl   = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const serviceRole   = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!;
const openAiKey     = Deno.env.get("OPENAI_API_KEY")!;

/* ─── Clients ───────────────────────────────────────────── */
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: openAiKey });

/* ─── Helper: Storage へ mp3 を private アップロード ─────── */
async function uploadAudio(buf: Uint8Array, signedUrl: any) {
  try {
    console.log("uploadAudio: PUT audio to signed URL");
    const put = await supabase.storage
      .from("diary-audio")
      .uploadToSignedUrl(signedUrl.path, signedUrl.token, buf, {
        contentType: "audio/mpeg",
      });
    if (put.error) throw put.error;

    return signedUrl.path;
  } catch (e) {
    console.error("uploadAudio error:", e);
    throw e;
  }
}

/* ─── Deep Feedback 生成 ─────────────────────────────────── */
export async function processDeepFeedback(record: any, msgId: number, signedUrl: any) {
  try {
    console.log("processDeepFeedback: started", record.diary_id, msgId);

    /* ❶ ディープ版 Chat Completion */
    console.log("processDeepFeedback: call OpenAI ChatCompletion");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "あなたは感謝日記を書くユーザーをサポートするコーチです。ユーザーの日記に対して、" +
            "具体的で建設的なフィードバックをしてください。700字以内でお願いします。" +
            "ユーザーの成長や気づきを促し、良い点を強調しつつ、さらなる視点を提供してください。",
        },
        { role: "user", content: record.text },
      ],
    });

    const deepText =
      completion.choices?.[0]?.message?.content?.trim() ?? "素晴らしい感謝の気持ちですね！";
    console.log("processDeepFeedback: ChatCompletion ok →", deepText);

    /* ❷ Text-to-Speech */
    console.log("processDeepFeedback: call OpenAI TTS");
    const speechRes = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "shimmer",
      input: deepText,
      response_format: "mp3",
      speed: 1.0,
    });

    /* ❸ 音声アップロード */
    const buf = new Uint8Array(await speechRes.arrayBuffer());
    const audioPath = await uploadAudio(buf, signedUrl);
    console.log("processDeepFeedback: audio uploaded →", audioPath);

    /* ❹ owner を diary 作者 UID に付け替え */
    const { data: d } = await supabase
      .from("diaries")
      .select("user_id")
      .eq("id", record.diary_id)
      .single();
    const ownerUid = d?.user_id;

    const { error: ownErr } = await supabase.rpc("set_storage_owner", {
      p_bucket: "diary-audio",
      p_name:   audioPath,
      p_owner:  ownerUid,
    });
    if (ownErr) throw ownErr;
    console.log("processDeepFeedback: set_storage_owner ok");

    /* ❺ クイック版メッセージを更新 */
    const { error: updateErr } = await supabase
      .from("diary_messages")
      .update({
        text: deepText,
        audio_url: audioPath
      })
      .eq("id", msgId);

    if (updateErr) throw updateErr;
    console.log("processDeepFeedback: message updated to deep version");

    return { success: true, audioPath };
  } catch (e) {
    console.error("processDeepFeedback error:", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
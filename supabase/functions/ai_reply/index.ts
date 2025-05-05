import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
async function uploadAudio(buf: Uint8Array, diaryId: number) {
  const path = `ai/${diaryId}/${Date.now()}.mp3`;

  console.log("uploadAudio: createSignedUploadUrl", path);
  const { data: up, error: upErr } = await supabase
    .storage.from("diary-audio")
    .createSignedUploadUrl(path);
  if (upErr || !up) throw upErr ?? new Error("signed upload url failed");

  console.log("uploadAudio: PUT audio");
  const put = await supabase.storage
    .from("diary-audio")
    .uploadToSignedUrl(up.path, up.token, buf, {
      contentType: "audio/mpeg",
    });
  if (put.error) throw put.error;

  return path;
}

/* ─── Main ─────────────────────────────────────────────── */
serve(async (req) => {
  try {
    /* ❶ Realtime Webhook ペイロードを取得 ------------------ */
    const { record } = await req.json();
    if (!record) return new Response("no payload", { status: 400 });

    // user 発言以外はスキップ
    if (record.role !== "user") {
      console.log("ai_reply: skipped (not user)");
      return new Response("ignore");
    }

    console.log("ai_reply: new user msg", record);

    /* ❷ 同じ diary で AI レスポンスが 3 回を超えたら打ち切り */
    const { count } = await supabase
      .from("diary_messages")
      .select("*", { head: true, count: "exact" })
      .eq("diary_id", record.diary_id)
      .eq("role", "ai");
    if ((count ?? 0) >= 999) {
      console.log("ai_reply: limit reached");
      return new Response("limit");
    }

    /* ❸ OpenAI ChatCompletion ----------------------------- */
    console.log("ai_reply: call OpenAI ChatCompletion");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 256,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "あなたは感謝日記を書くユーザーをサポートするコーチです。丁寧語で 200 字以内でフィードバックしてください。",
        },
        { role: "user", content: record.text },
      ],
    });

    const replyText =
      completion.choices?.[0]?.message?.content?.trim() ?? "素敵ですね！";
    console.log("ai_reply: ChatCompletion ok →", replyText);

    /* ❹ OpenAI Text‑to‑Speech ----------------------------- */
    console.log("ai_reply: call OpenAI TTS");
    const speechRes = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "shimmer",
      input: replyText,
      response_format: "mp3",
      speed: 1.0,
    });

    const buf = new Uint8Array(await speechRes.arrayBuffer());
    const audioPath = await uploadAudio(buf, record.diary_id);
    console.log("ai_reply: audio uploaded (OpenAI) →", audioPath);

    /* ❹-extra owner を diary 作者 UID に付け替え ----------- */
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
    console.log("ai_reply: set_storage_owner ok");

    /* ❺ AI メッセージ挿入 -------------------------------- */
    const { error } = await supabase.from("diary_messages").insert({
      diary_id:  record.diary_id,
      role:      "ai",
      text:      replyText,
      audio_url: audioPath,
    });
    if (error) throw error;
    console.log("ai_reply: insert ai message");

    return new Response("ok");
  } catch (e) {
    console.error("ai_reply: error", e);
    return new Response(
      `error: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    );
  }
});

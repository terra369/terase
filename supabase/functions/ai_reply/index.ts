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

/* ─── Helper: Deep Feedback Import ─────────────────────── */
import { processDeepFeedback } from "./deep.ts";

/* ─── Helper: Deep Feedback (BG Task) ──────────────────── */
async function runDeepFeedback(record: any, msgId: number, up: any) {
  try {
    return await processDeepFeedback(record, msgId, up);
  } catch (e) {
    console.error("runDeepFeedback: error", e);
  }
}

/* ─── Main ─────────────────────────────────────────────── */
serve(async (req, ctx) => {
  const { record } = await req.json();
  if (!record || record.role !== "user") return new Response("ignore");

  /* ❶ ライト版 Chat */
  const quick = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    max_tokens: 256,
    messages: [
      { role: "system",
        content: "あなたは感謝日記をサポートするコーチです。200字以内、全ひらがな、完全肯定で返答。" },
      { role: "user", content: record.text },
    ],
  });
  const replyText = quick.choices[0].message.content.trim();

  /* ❷ mp3 保存用の署名付き URL を発行 */
  const { data: up } = await supabase.storage
      .from("diary-audio")
      .createSignedUploadUrl(`ai/${record.diary_id}/${Date.now()}.mp3`);
  if (!up) throw new Error("signedUrl failed");

  /* ❸ DB へライト版挿入 */
  const { data: msg } = await supabase.from("diary_messages")
      .insert({
        diary_id: record.diary_id,
        role: "ai",
        text: replyText,
        audio_url: null,
      }).select().single();

  /* ❹ BG タスクでディープ版生成 */
  if (ctx && typeof (ctx as any).waitUntil === "function") {
    (ctx as any).waitUntil(runDeepFeedback(record, msg.id, up));
  } else {
    // ローカル環境など ctx.waitUntil が未実装の場合はフォールバックで非同期実行
    runDeepFeedback(record, msg.id, up);
  }

  return new Response(JSON.stringify({ replyText, upload: up }), {
    headers: { "Content-Type": "application/json" },
  });
});
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { uploadAudio } from '@/lib/uploadAudio'
import { transcribe } from '@/lib/whisper'

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  const { user } = (await supabase.auth.getUser()).data
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 })

  const form = await req.formData()
  const blob = form.get('audio') as Blob
  const audioUrl = await uploadAudio(blob, user.id)
  const transcript = await transcribe(audioUrl)

  return NextResponse.json({ audioUrl, transcript })
}
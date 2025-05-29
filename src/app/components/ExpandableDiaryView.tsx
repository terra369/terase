'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { supabaseBrowser } from '@/lib/supabase/browser'

interface DiaryMessage {
  id: number
  role: 'user' | 'ai'
  text: string
  audio_url?: string
  created_at: string
  signed?: string | null
}

interface ExpandableDiaryViewProps {
  selectedDate: string
  diaryId?: number
  initialMessages: DiaryMessage[]
}



export default function ExpandableDiaryView({ 
  selectedDate, 
  diaryId, 
  initialMessages
}: ExpandableDiaryViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<DiaryMessage[]>(initialMessages)

  // Update messages when initialMessages changes and sign audio URLs
  useEffect(() => {
    const signAudioUrls = async () => {
      const signedMessages = await Promise.all(
        initialMessages.map(async (msg) => {
          if (msg.audio_url) {
            const { data } = await supabaseBrowser
              .storage
              .from('diary-audio')
              .createSignedUrl(msg.audio_url, 600)
            return { ...msg, signed: data?.signedUrl ?? null }
          }
          return msg
        })
      )
      setMessages(signedMessages)
    }
    signAudioUrls()
  }, [initialMessages])

  // Handle realtime updates
  const handleInsert = useCallback(async (m: DiaryMessage) => {
    if (m.audio_url) {
      const { data } = await supabaseBrowser
        .storage
        .from('diary-audio')
        .createSignedUrl(m.audio_url, 600)
      m.signed = data?.signedUrl ?? null
    }
    setMessages((prev) => [...prev, m])
  }, [])


  // Use realtime updates if diaryId is available
  useEffect(() => {
    if (!diaryId) return
    
    const channel = supabaseBrowser
      .channel(`diary_messages_${diaryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'diary_messages',
          filter: `diary_id=eq.${diaryId}`,
        },
        (payload) => {
          handleInsert(payload.new as DiaryMessage)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [diaryId, handleInsert])

  if (!messages.length) return null

  return (
    <div className="w-full">
      {/* Summary Card - Always visible */}
      <Card className="w-full shadow-[0px_12px_20px_#0000000d] rounded-[17px] border-0 mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex-1">
                <h3 className="font-semibold text-[17px] text-[#212121] mb-1">
                  {selectedDate} の日記
                </h3>
                <p className="text-[13px] text-[#212121] line-clamp-2">
                  {messages[0]?.text || 'No content'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-4 p-1"
            >
              {isExpanded ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Expanded View */}
      {isExpanded && (
        <Card className="w-full shadow-[0px_12px_20px_#0000000d] rounded-[17px] border-0 mb-3">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[17px] text-[#212121]">
                完全な会話
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>


            {/* Chat messages */}
            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg ${m.role === 'ai'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-4'
                    : 'bg-gray-50 dark:bg-gray-800/30 mr-4'}`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.text}</p>
                </div>
              ))}
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  )
}
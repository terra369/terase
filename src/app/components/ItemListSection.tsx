'use client'

import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, Play } from "lucide-react"
import React from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"

interface DiaryMessage {
  id: number
  role: 'user' | 'ai'
  text: string
  audio_url?: string
  created_at: string
}

interface ItemListSectionProps {
  selectedDate?: string // Format: YYYY-MM-DD
}

export default function ItemListSection({ selectedDate }: ItemListSectionProps) {
  const router = useRouter()

  const fetcher = (url: string): Promise<DiaryMessage[]> =>
    fetch(url).then((r) => r.json() as Promise<DiaryMessage[]>)

  const { data: messages } = useSWR<DiaryMessage[]>(
    selectedDate ? `/api/diaries/messages?date=${selectedDate}` : null,
    fetcher
  )

  if (!selectedDate || !messages?.length) {
    return (
      <section className="flex flex-col w-full items-center justify-center gap-4 py-8">
        <p className="text-[#212121] text-center font-['Euclid_Circular_B-Regular']">
          {selectedDate ? '今日はまだ日記がありません' : '日付を選択してください'}
        </p>
      </section>
    )
  }

  const handleItemClick = (message: DiaryMessage) => {
    // Navigate to diary detail page or play audio
    if (selectedDate) {
      router.push(`/diary/${selectedDate}`)
    }
  }

  const handlePlayAudio = (audioUrl: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // TODO: Implement audio playback
    console.log('Play audio:', audioUrl)
  }

  return (
    <section className="flex flex-col w-full items-start gap-3">
      {messages.map((message, index) => {
        const isUser = message.role === 'user'
        const title = isUser ? `あなたの記録 ${index + 1}` : `AIの返答 ${index + 1}`
        const hasAudio = Boolean(message.audio_url)
        
        return (
          <Card
            key={message.id}
            className="w-full shadow-[0px_12px_20px_#0000000d] rounded-[17px] border-0"
          >
            <CardContent className="flex items-center justify-between gap-6 p-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="flex-shrink-0">
                  <div className="relative w-12 h-12">
                    <div className="absolute w-12 h-12 top-0 left-0 rounded-3xl border-[3px] border-solid border-[#21212126] rotate-[-90deg]" />
                    <div className="absolute w-[42px] h-[42px] top-[3px] left-[3px] bg-white rounded-[21px] flex items-center justify-center">
                      {hasAudio ? (
                        <button
                          onClick={(e) => message.audio_url && handlePlayAudio(message.audio_url, e)}
                          className="flex items-center justify-center"
                        >
                          <Play
                            size={13}
                            className="text-[#ec6a52] fill-[#ec6a52]"
                          />
                        </button>
                      ) : (
                        <div className="flex gap-0.5">
                          <div className="w-1 h-3.5 rounded-[1px] bg-[#ec6a52]" />
                          <div className="w-1 h-3.5 rounded-[1px] bg-[#ec6a52]" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-1.5 flex-1">
                  <div className="w-full">
                    <h3 className="font-semibold text-[17px] text-[#212121] mt-[-1px] font-['Euclid_Circular_B-SemiBold']">
                      {title}
                    </h3>
                    <p className="text-[13px] text-[#212121] mt-[-1px] font-['Euclid_Circular_B-Regular'] line-clamp-3">
                      {message.text}
                    </p>
                  </div>
                </div>
              </div>

              <button onClick={() => handleItemClick(message)}>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
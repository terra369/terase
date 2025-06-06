'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Calendar from '@/app/components/Calendar'
import ExpandableDiaryView from '@/app/components/ExpandableDiaryView'
import { useDiary } from '@/core/hooks/useDiary'

interface DiaryMessage {
  id: number
  role: 'user' | 'ai'
  text: string
  audio_url?: string
  created_at: string
}

interface DiaryData {
  id: number
  date: string
  messages: DiaryMessage[]
}

export default function CalendarClient() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  // Use centralized diary hook
  const { diary, messages, getDiary } = useDiary()

  const formattedDate = format(selectedDate, 'yyyy-MM-dd')

  // Fetch diary data when selected date changes
  useEffect(() => {
    getDiary(formattedDate)
  }, [getDiary, formattedDate])

  // Convert to the format expected by ExpandableDiaryView
  const diaryData: DiaryData | null = diary ? {
    id: diary.id,
    date: diary.date,
    messages: messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      text: msg.text,
      audio_url: msg.audio_url || undefined,
      created_at: msg.created_at
    }))
  } : null

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
  }

  const handleBackClick = () => {
    router.push('/')
  }

  return (
    <div className="bg-[#ecedf3] flex flex-row justify-center w-full min-h-screen">
      <div className="bg-[#ecedf3] w-full max-w-[390px] md:max-w-2xl lg:max-w-4xl relative flex flex-col">
        <header className="flex items-center justify-center pt-12 md:pt-16 lg:pt-20 px-4 md:px-6 lg:px-8 relative">
          <button 
            onClick={handleBackClick}
            className="absolute left-4 md:left-6 lg:left-8 touch-manipulation"
          >
            <ArrowLeft className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-[#212121]" />
          </button>
          <h1 className="font-['Bakbak_One-Regular'] font-normal text-[#212121] text-2xl md:text-3xl lg:text-4xl text-center tracking-[0]">
            review
          </h1>
        </header>

        <main className="flex flex-col flex-1 w-full relative">
          {/* Calendar Section */}
          <div className="w-full px-2 md:px-4 lg:px-6">
            <Calendar 
              selectedDate={selectedDate} 
              onDateSelect={handleDateSelect}
            />
          </div>

          {/* Diary Content Section */}
          <div className="w-full px-4 md:px-6 lg:px-8 pb-6">
            {diaryData && diaryData.messages.length > 0 ? (
              <ExpandableDiaryView
                selectedDate={formattedDate}
                diaryId={diaryData.id}
                initialMessages={diaryData.messages}
              />
            ) : (
              <div className="flex flex-col w-full items-center justify-center gap-4 py-8">
                <p className="text-[#212121] text-center text-sm md:text-base lg:text-lg font-['Euclid_Circular_B-Regular']">
                  {formattedDate === format(new Date(), 'yyyy-MM-dd') 
                    ? '今日はまだ日記がありません' 
                    : 'この日の日記はありません'}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Calendar from '@/app/components/Calendar'
import ExpandableDiaryView from '@/app/components/ExpandableDiaryView'
import useSWR from 'swr'

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

  const fetcher = async (url: string): Promise<DiaryData | null> => {
    const response = await fetch(url)
    if (!response.ok) return null
    return response.json()
  }

  const formattedDate = format(selectedDate, 'yyyy-MM-dd')
  const { data: diaryData } = useSWR<DiaryData | null>(
    `/api/diaries/${formattedDate}`,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false
    }
  )

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
  }

  const handleBackClick = () => {
    router.push('/')
  }

  return (
    <div className="bg-[#ecedf3] flex flex-row justify-center w-full min-h-screen">
      <div className="bg-[#ecedf3] w-full max-w-[390px] relative flex flex-col">
        <header className="flex items-center justify-center pt-[60px] px-6 relative">
          <button 
            onClick={handleBackClick}
            className="absolute left-6"
          >
            <ArrowLeft className="w-7 h-7 text-[#212121]" />
          </button>
          <h1 className="font-['Bakbak_One-Regular'] font-normal text-[#212121] text-[28px] text-center tracking-[0]">
            review
          </h1>
        </header>

        <main className="flex flex-col flex-1 w-full relative">
          {/* Calendar Section */}
          <div className="w-full px-2">
            <Calendar 
              selectedDate={selectedDate} 
              onDateSelect={handleDateSelect}
            />
          </div>

          {/* Diary Content Section */}
          <div className="w-full px-4 pb-6">
            {diaryData && diaryData.messages.length > 0 ? (
              <ExpandableDiaryView
                selectedDate={formattedDate}
                diaryId={diaryData.id}
                initialMessages={diaryData.messages}
              />
            ) : (
              <div className="flex flex-col w-full items-center justify-center gap-4 py-8">
                <p className="text-[#212121] text-center font-['Euclid_Circular_B-Regular']">
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
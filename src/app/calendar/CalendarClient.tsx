'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Calendar from '@/app/components/Calendar'
import ItemListSection from '@/app/components/ItemListSection'

export default function CalendarClient() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

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

          {/* Item List Section */}
          <div className="w-full px-4 pb-6">
            <ItemListSection 
              selectedDate={format(selectedDate, 'yyyy-MM-dd')}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
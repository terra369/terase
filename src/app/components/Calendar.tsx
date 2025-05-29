'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useSWR from 'swr'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns'

interface DiaryData {
  date: string
  count?: number
  mood_emoji?: string
}

interface CalendarProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
}

export default function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date())
  
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const ym = `${year}-${String(month).padStart(2, '0')}`

  const fetcher = (url: string): Promise<DiaryData[]> =>
    fetch(url).then((r) => r.json() as Promise<DiaryData[]>)

  const { data } = useSWR<DiaryData[]>(`/api/diaries?month=${ym}`, fetcher)

  const { calendarDays, diaryMap } = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // Sunday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const days = eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    })

    const dMap: Record<string, DiaryData> = Object.fromEntries(
      (data ?? []).map((d) => [d.date, d])
    )

    return { calendarDays: days, diaryMap: dMap }
  }, [currentDate, data])

  const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土']

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const handleDateClick = (date: Date) => {
    if (onDateSelect) {
      onDateSelect(date)
    }
  }

  // Split days into weeks
  const weeks = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7))
  }

  return (
    <div className="flex flex-col w-full items-center gap-4 md:gap-6 bg-[#ecedf3] p-3 md:p-4">
      {/* Month navigation header */}
      <div className="flex items-center justify-between px-3 py-0 w-full max-w-sm md:max-w-md lg:max-w-lg">
        <button 
          onClick={() => navigateMonth('prev')}
          className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 touch-manipulation"
        >
          <ChevronLeft className="w-6 h-6 md:w-7 md:h-7 text-gray-800" />
        </button>

        <h2 className="font-['Euclid_Circular_B-Medium'] font-medium text-[#212121] text-lg md:text-xl lg:text-2xl">
          {format(currentDate, 'yyyy/MM')}
        </h2>

        <button 
          onClick={() => navigateMonth('next')}
          className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 touch-manipulation"
        >
          <ChevronRight className="w-6 h-6 md:w-7 md:h-7 text-gray-800" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="flex flex-col items-start gap-1 w-full max-w-sm md:max-w-md lg:max-w-lg">
        {/* Days of week header */}
        <div className="flex items-center justify-between w-full">
          {daysOfWeek.map((day, index) => (
            <div
              key={`day-${index}`}
              className="w-12 md:w-14 lg:w-16 font-['Euclid_Circular_B-Medium'] font-medium text-[#212121] text-xs md:text-sm lg:text-base text-center"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        {weeks.map((week, weekIndex) => (
          <div
            key={`week-${weekIndex}`}
            className="flex items-center justify-between w-full"
          >
            {week.map((date, dayIndex) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              const isCurrentMonth = isSameMonth(date, currentDate)
              const isSelected = selectedDate && isSameDay(date, selectedDate)
              const isToday = isSameDay(date, new Date())
              const hasDiary = diaryMap[dateStr]
              const dayNumber = date.getDate()

              // Handle days outside current month
              if (!isCurrentMonth) {
                return (
                  <div key={`empty-${weekIndex}-${dayIndex}`} className="w-12 md:w-14 lg:w-16 h-12 md:h-14 lg:h-16">
                    <div className="w-12 md:w-14 lg:w-16 h-12 md:h-14 lg:h-16 font-normal text-transparent text-xs md:text-sm lg:text-base text-center">
                      0
                    </div>
                  </div>
                )
              }

              // Handle current day (today) - show with background like other days
              if (isToday && !isSelected) {
                return (
                  <div key={`day-${dayNumber}`} className="relative w-12 md:w-14 lg:w-16 h-12 md:h-14 lg:h-16">
                    <button
                      onClick={() => handleDateClick(date)}
                      className="relative w-12 md:w-14 lg:w-16 h-12 md:h-14 lg:h-16 hover:opacity-80 transition-opacity touch-manipulation"
                    >
                      <div
                        className={`absolute w-7 h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                          ${hasDiary ? 'bg-[#ec6a52]' : 'bg-[#21212157]'} 
                          rounded-full`}
                      />
                      <div className="absolute top-0 left-0 font-['Euclid_Circular_B-Regular'] font-normal text-white text-sm md:text-base lg:text-lg w-full h-full text-center flex items-center justify-center">
                        {dayNumber}
                      </div>
                    </button>
                  </div>
                )
              }

              // Handle days with diary entries or selected state
              return (
                <div key={`day-${dayNumber}`} className="relative w-12 md:w-14 lg:w-16 h-12 md:h-14 lg:h-16">
                  <button
                    onClick={() => handleDateClick(date)}
                    className="relative w-12 md:w-14 lg:w-16 h-12 md:h-14 lg:h-16 hover:opacity-80 transition-opacity touch-manipulation"
                  >
                    <div
                      className={`absolute w-7 h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                        ${hasDiary ? 'bg-[#ec6a52]' : 'bg-[#21212157]'} 
                        ${isSelected ? 'rounded-lg' : 'rounded-full'}`}
                    />
                    <div className="absolute top-0 left-0 font-['Euclid_Circular_B-Regular'] font-normal text-white text-sm md:text-base lg:text-lg w-full h-full text-center flex items-center justify-center">
                      {dayNumber}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
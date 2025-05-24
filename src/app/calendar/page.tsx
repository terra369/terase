import { redirect } from 'next/navigation'
import { supabaseServer } from "@/lib/supabase/server";
import DiaryHeatmap from '@/app/components/DiaryHeatmap'
import Link from 'next/link'

export default async function Calendar() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = new Date()
  return (
    <main className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">My Gratitude Calendar</h1>
        <Link 
          href="/"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          AIと話す
        </Link>
      </div>
      <DiaryHeatmap year={today.getFullYear()} month={today.getMonth() + 1} />
    </main>
  )
}
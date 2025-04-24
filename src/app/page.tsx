import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServer'
import DiaryHeatmap from '@/app/components/DiaryHeatmap'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = new Date()
  return (
    <main className="p-4">
      <h1 className="mb-4 text-xl font-bold">My Gratitude Calendar</h1>
      <DiaryHeatmap year={today.getFullYear()} month={today.getMonth() + 1} />
    </main>
  )
}
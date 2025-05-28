import { redirect } from 'next/navigation'
import { supabaseServer } from "@/lib/supabase/server";
import CalendarClient from './CalendarClient'

export default async function Calendar() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <CalendarClient />
}
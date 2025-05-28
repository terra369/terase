import { redirect } from 'next/navigation'
import { supabaseServer } from "@/lib/supabase/server";
import MobileConversationInterface from '@/components/MobileConversationInterface'

export default async function Home() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <MobileConversationInterface />
}
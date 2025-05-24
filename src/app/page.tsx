import { redirect } from 'next/navigation'
import { supabaseServer } from "@/lib/supabase/server";
import ConversationInterface from '@/components/ConversationInterface'

export default async function Home() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="relative h-screen">
      <ConversationInterface />
    </main>
  )
}
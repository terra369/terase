import { redirect } from 'next/navigation'
import { supabaseServer } from "@/lib/supabase/server";
import ConversationInterface from '@/components/ConversationInterface'
import MobileConversationInterface from '@/components/MobileConversationInterface'

export default async function Home() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="relative h-screen">
      {/* Mobile interface for small screens */}
      <div className="md:hidden">
        <MobileConversationInterface />
      </div>
      
      {/* Desktop interface for larger screens */}
      <div className="hidden md:block">
        <ConversationInterface />
      </div>
    </main>
  )
}
import { redirect } from 'next/navigation'
import { supabaseServer } from "@/lib/supabase/server";
import HomeClient from './HomeClient';

export default async function Home() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ユーザー名を取得
  const userName = user.email?.split('@')[0] || 'User';
  
  // クライアントコンポーネントに必要な情報を渡す
  return <HomeClient userName={userName} />
}
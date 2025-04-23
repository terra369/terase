'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface MobileLoginCardProps {
  /** Google ボタンが押された時に呼ばれる
   *  親で signInWithOAuth を実行する */
  onGoogle: () => void | Promise<void>
}

export function MobileLoginCard({ onGoogle }: MobileLoginCardProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    try {
      setLoading(true)
      await onGoogle()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm mx-auto shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col space-y-4">
        <Button
          variant="outline"
          onClick={handleClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            /* 公式アイコンは任意・ここでは SVG を直置き */
            <svg className="h-4 w-4" width="16" height="16" viewBox="0 0 48 48">
              {/* paths 省略 */}
            </svg>
          )}
          <span>{loading ? 'Signing in…' : 'Sign in with Google'}</span>
        </Button>
      </CardContent>

      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
      </CardFooter>
    </Card>
  )
}
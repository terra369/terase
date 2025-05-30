'use client'
import { Volume2 } from 'lucide-react'
import { Button } from './button'

interface UnmuteButtonProps {
  onUnmute: () => void
}

export function UnmuteButton({ onUnmute }: UnmuteButtonProps) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button
        onClick={onUnmute}
        className="group relative bg-white/90 backdrop-blur-sm hover:bg-white text-[#212121] shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-3 rounded-full flex items-center gap-3"
        aria-label="音声をオンにする"
      >
        <div className="relative">
          <Volume2 className="w-5 h-5" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#ec6a52] rounded-full animate-pulse" />
        </div>
        <span className="font-medium">タップして音声をON</span>
      </Button>
      
      {/* iOS向けの追加情報 */}
      {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
        <p className="text-xs text-[#666] text-center mt-2 max-w-[200px]">
          デバイスのサイレントモードを<br />オフにしてください
        </p>
      )}
    </div>
  )
}
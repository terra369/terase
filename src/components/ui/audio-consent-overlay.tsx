'use client'
import { useState, useEffect } from 'react'
import { Button } from './button'
import { Mic, Volume2 } from 'lucide-react'
import { initializeAudioContext } from '@/lib/audioContext'
import { startAudioKeepAlive } from '@/lib/audioKeepAlive'

interface AudioConsentOverlayProps {
  onConsent: () => void
}

export function AudioConsentOverlay({ onConsent }: AudioConsentOverlayProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 bg-[#ecedf3] z-50 flex flex-col items-center justify-center">
      {/* Logo/Title */}
      <div className="mb-8">
        <h1 className="font-bold text-[#212121] text-[32px] md:text-4xl lg:text-5xl text-center tracking-wider">
          terase
        </h1>
      </div>

      {/* Main message */}
      <div className="text-center mb-12 px-8 max-w-md">
        <h2 className="text-xl md:text-2xl font-semibold text-[#212121] mb-4">
          音声機能を有効にする
        </h2>
        <p className="text-[#666] text-sm md:text-base leading-relaxed">
          teraseとの音声対話を開始するために、<br/>
          音声再生の許可が必要です。
        </p>
      </div>

      {/* Start button */}
      <div className="flex flex-col items-center gap-4">
        <Button
          onClick={async () => {
            // AudioContextを事前に初期化して、確実にアクティブにする
            const audioContext = await initializeAudioContext()
            if (audioContext) {
              // 小さな無音を再生してAudioContextを確実にアクティブにする
              const oscillator = audioContext.createOscillator()
              const gainNode = audioContext.createGain()
              gainNode.gain.value = 0.00001
              oscillator.connect(gainNode)
              gainNode.connect(audioContext.destination)
              oscillator.start()
              oscillator.stop(audioContext.currentTime + 0.1)
              
              // AudioContextがrunning状態になるまで待機
              if (audioContext.state === 'suspended') {
                await audioContext.resume()
              }
              
              // AudioContextをアクティブに保つ仕組みを開始
              startAudioKeepAlive()
              
              // 少し待機してから実際のコンセント処理を実行
              setTimeout(() => {
                onConsent()
              }, 100)
            } else {
              // AudioContext初期化に失敗した場合でも続行
              onConsent()
            }
          }}
          className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] bg-[#ec6a52] hover:bg-[#ec6a52]/90 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
          size="icon"
        >
          <Mic className="w-12 h-12 md:w-14 md:h-14 text-white" />
        </Button>
        <p className="text-[#666] text-sm">
          タップして開始
        </p>
      </div>

      {/* iOS specific info */}
      <div className="absolute bottom-8 left-0 right-0 text-center px-8">
        <p className="text-xs text-[#999] max-w-sm mx-auto">
          iOS Safariでは、音声再生にはユーザーの明示的な許可が必要です。
        </p>
        {/* iOSの場合の追加情報 */}
        {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[#666]">
            <Volume2 className="w-4 h-4" />
            <span className="text-xs">デバイスのサイレントモードをオフにしてください</span>
          </div>
        )}
      </div>
    </div>
  )
}
'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, X, Play } from "lucide-react"
import { Canvas } from '@react-three/fiber'
import { BallBot } from '@/components/BallBot'
import { useAudioReactive } from '@/components/hooks/useAudioReactive'
import { supabaseBrowser } from '@/lib/supabase/browser'

interface DiaryMessage {
  id: number
  role: 'user' | 'ai'
  text: string
  audio_url?: string
  created_at: string
  signed?: string | null
}

interface ExpandableDiaryViewProps {
  selectedDate: string
  diaryId?: number
  initialMessages: DiaryMessage[]
  onClose?: () => void
}

// Chat input component
const ChatInput = ({ onSend }: { onSend: (text: string) => Promise<void> }) => {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSend(message.trim())
      setMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex space-x-2 mt-4">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="メッセージを入力..."
        className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isSubmitting}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className={`px-4 py-2 rounded-md text-white ${isSubmitting ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
      >
        {isSubmitting ? '送信中...' : '送信'}
      </button>
    </form>
  )
}

// Audio player component with reactive visualization
const AudioPlayerWithReactive = ({ src }: { src: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { setupExistingAudio } = useAudioReactive()
  
  useEffect(() => {
    if (audioRef.current) {
      setupExistingAudio(audioRef.current)
    }
  }, [setupExistingAudio])
  
  return <audio ref={audioRef} controls src={src} className="w-full mt-1" />
}

export default function ExpandableDiaryView({ 
  selectedDate, 
  diaryId, 
  initialMessages,
  onClose 
}: ExpandableDiaryViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<DiaryMessage[]>(initialMessages)
  const { speak } = useAudioReactive()

  // Update messages when initialMessages changes and sign audio URLs
  useEffect(() => {
    const signAudioUrls = async () => {
      const signedMessages = await Promise.all(
        initialMessages.map(async (msg) => {
          if (msg.audio_url) {
            const { data } = await supabaseBrowser
              .storage
              .from('diary-audio')
              .createSignedUrl(msg.audio_url, 600)
            return { ...msg, signed: data?.signedUrl ?? null }
          }
          return msg
        })
      )
      setMessages(signedMessages)
    }
    signAudioUrls()
  }, [initialMessages])

  // Handle realtime updates
  const handleInsert = useCallback(async (m: DiaryMessage) => {
    if (m.audio_url) {
      const { data } = await supabaseBrowser
        .storage
        .from('diary-audio')
        .createSignedUrl(m.audio_url, 600)
      m.signed = data?.signedUrl ?? null
    }
    setMessages((prev) => [...prev, m])
  }, [])

  // Handle sending new messages
  const handleSend = async (text: string) => {
    if (!diaryId) return

    // Add user message to UI immediately
    const tempUserMsg: DiaryMessage = {
      id: Date.now(),
      role: 'user',
      text,
      audio_url: undefined,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])

    // Send to AI function
    const { data } = await fetch("/api/functions/v1/ai_reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, diaryId })
    }).then(res => res.json())

    // Speak the reply
    if (data?.replyText) {
      await speak(data.replyText)
    }

    // Subscribe to deep broadcast channel
    supabaseBrowser
      .channel(`diary_${diaryId}`)
      .on("broadcast", { event: "deep" }, payload => {
        // Show HUD notification
        const hudContainer = document.createElement('div')
        document.body.appendChild(hudContainer)
        const hudToast = document.createElement('div')
        hudToast.innerHTML = 'AI is processing a deep response...'
        hudToast.className = 'bg-blue-900/80 text-blue-100 p-3 rounded-lg fixed top-4 right-4 z-50'
        hudContainer.appendChild(hudToast)
        setTimeout(() => hudContainer.remove(), 5000)

        if (payload.text) speak(payload.text)
      })
      .subscribe()
  }

  // Use realtime updates if diaryId is available
  useEffect(() => {
    if (!diaryId) return
    
    const channel = supabaseBrowser
      .channel(`diary_messages_${diaryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'diary_messages',
          filter: `diary_id=eq.${diaryId}`,
        },
        (payload) => {
          handleInsert(payload.new as DiaryMessage)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [diaryId, handleInsert])

  if (!messages.length) return null

  const firstMessage = messages[0]
  const hasAudio = Boolean(firstMessage?.signed)

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (firstMessage?.signed) {
      const audio = new Audio(firstMessage.signed)
      audio.play()
    }
  }

  return (
    <div className="w-full">
      {/* Summary Card - Always visible */}
      <Card className="w-full shadow-[0px_12px_20px_#0000000d] rounded-[17px] border-0 mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {hasAudio && (
                <button
                  onClick={handlePlayAudio}
                  className="flex-shrink-0 w-10 h-10 bg-[#ec6a52]/10 rounded-full flex items-center justify-center hover:bg-[#ec6a52]/20 transition-colors"
                >
                  <Play size={16} className="text-[#ec6a52] fill-[#ec6a52]" />
                </button>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-[17px] text-[#212121] mb-1">
                  {selectedDate} の日記
                </h3>
                <p className="text-[13px] text-[#212121] line-clamp-2">
                  {messages[0]?.text || 'No content'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-4 p-1"
            >
              {isExpanded ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Expanded View */}
      {isExpanded && (
        <Card className="w-full shadow-[0px_12px_20px_#0000000d] rounded-[17px] border-0 mb-3">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[17px] text-[#212121]">
                完全な会話
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* 3D Visualization */}
            <div className="h-40 w-full rounded-lg overflow-hidden mb-4 border border-blue-100 dark:border-blue-900 shadow-md">
              <Canvas camera={{ position: [0, 0, 3] }}>
                <Suspense fallback={null}>
                  <BallBot />
                  {/* eslint-disable-next-line react/no-unknown-property */}
                  <ambientLight intensity={0.4} />
                </Suspense>
              </Canvas>
            </div>

            {/* Chat messages */}
            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg ${m.role === 'ai'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-4'
                    : 'bg-gray-50 dark:bg-gray-800/30 mr-4'}`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.text}</p>
                  {m.signed && (
                    <AudioPlayerWithReactive src={m.signed} />
                  )}
                </div>
              ))}
            </div>

            {/* Chat input - only show if diaryId exists */}
            {diaryId && <ChatInput onSend={handleSend} />}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
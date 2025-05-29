'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { Canvas } from '@react-three/fiber'
import { BallBot } from '@/components/BallBot'
import { supabaseBrowser } from '@/lib/supabase/browser'

interface DiaryMessage {
  id: number
  role: 'user' | 'ai'
  text: string
  created_at: string
}

interface ExpandableDiaryViewProps {
  selectedDate: string
  diaryId?: number
  initialMessages: DiaryMessage[]
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

// Format timestamp for display
const formatTimestamp = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ja-JP', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export default function ExpandableDiaryView({ 
  selectedDate, 
  diaryId, 
  initialMessages
}: ExpandableDiaryViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Sort messages by creation time (oldest first)
  const sortedMessages = [...initialMessages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const [messages, setMessages] = useState<DiaryMessage[]>(sortedMessages)

  // Update messages when initialMessages changes
  useEffect(() => {
    const sorted = [...initialMessages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    setMessages(sorted)
  }, [initialMessages])

  // Handle realtime updates
  const handleInsert = useCallback((m: DiaryMessage) => {
    setMessages((prev) => {
      const newMessages = [...prev, m]
      // Sort by creation time to maintain chronological order
      return newMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })
  }, [])

  // Handle sending new messages
  const handleSend = async (text: string) => {
    if (!diaryId) return

    // Add user message to UI immediately
    const tempUserMsg: DiaryMessage = {
      id: Date.now(),
      role: 'user',
      text,
      created_at: new Date().toISOString()
    }
    setMessages(prev => {
      const newMessages = [...prev, tempUserMsg]
      return newMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })

    // Send to AI function
    await fetch("/api/functions/v1/ai_reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, diaryId })
    })

    // Subscribe to deep broadcast channel for text updates only
    supabaseBrowser
      .channel(`diary_${diaryId}`)
      .on("broadcast", { event: "deep" }, () => {
        // Show HUD notification
        const hudContainer = document.createElement('div')
        document.body.appendChild(hudContainer)
        const hudToast = document.createElement('div')
        hudToast.innerHTML = 'AI is processing a deep response...'
        hudToast.className = 'bg-blue-900/80 text-blue-100 p-3 rounded-lg fixed top-4 right-4 z-50'
        hudContainer.appendChild(hudToast)
        setTimeout(() => hudContainer.remove(), 5000)
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

  return (
    <div className="w-full">
      {/* Summary Card - Always visible */}
      <Card className="w-full shadow-[0px_12px_20px_#0000000d] rounded-[17px] border-0 mb-3">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-[17px] text-[#212121]">
                  {selectedDate} の日記
                </h3>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(firstMessage.created_at)}
                </span>
              </div>
              <p className="text-[14px] text-[#212121] line-clamp-2 leading-relaxed">
                {firstMessage?.text || 'No content'}
              </p>
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

            {/* Chat messages with timestamps */}
            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-4 rounded-lg ${m.role === 'ai'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 ml-4'
                    : 'bg-gray-50 dark:bg-gray-800/30 mr-4'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium ${m.role === 'ai' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-400'}`}>
                      {m.role === 'ai' ? 'AI' : 'あなた'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimestamp(m.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">
                    {m.text}
                  </p>
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
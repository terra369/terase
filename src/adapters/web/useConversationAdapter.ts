/**
 * Web adapter for core ConversationFlow
 * Bridges React hooks with core conversation functionality
 */

import { useCallback, useEffect, useState } from 'react'
import { ConversationFlow, ConversationState, ConversationMessage } from '@/core/conversation/flow'
import { useConversationStore } from '@/stores/useConversationStore'
import { useAudioStore } from '@/stores/useAudioStore'

export function useConversationAdapter(diaryId?: number) {
  const [conversationFlow] = useState(() => new ConversationFlow())
  const [coreState, setCoreState] = useState<ConversationState>(conversationFlow.getState())
  
  // Legacy store integration
  const {
    setState,
    addMessage,
    setLiveTranscript,
    setError,
    setCurrentAudioBlob
  } = useConversationStore()

  const { setSpeaking } = useAudioStore()

  // Sync core state with legacy stores
  useEffect(() => {
    conversationFlow.options = {
      onStateChange: (state) => {
        setCoreState(state)
        setState(state.status)
        setSpeaking(state.status === 'speaking')
        
        if (state.error) {
          setError(state.error)
        }
      },
      onMessage: (message) => {
        addMessage({
          content: message.text,
          speaker: message.role === 'ai' ? 'ai' : 'user'
        })
      },
      onError: (error) => {
        setError(error)
      }
    }
  }, [conversationFlow, setState, addMessage, setError, setSpeaking])

  // Load conversation history
  useEffect(() => {
    if (diaryId) {
      conversationFlow.loadConversationHistory(diaryId)
    }
  }, [diaryId, conversationFlow])

  // Process conversation using core flow
  const processConversation = useCallback(async (audioBlob: Blob) => {
    try {
      setCurrentAudioBlob(audioBlob)
      setLiveTranscript('')
      
      // Get user from legacy auth (this would need to be adapted for your auth system)
      const userId = await getCurrentUserId()
      
      await conversationFlow.processAudioConversation(audioBlob, userId)
      
    } catch (error) {
      console.error('Conversation processing error:', error)
    } finally {
      setCurrentAudioBlob(null)
    }
  }, [conversationFlow, setCurrentAudioBlob, setLiveTranscript])

  const startListening = useCallback(() => {
    setState('listening')
    setError(null)
    setLiveTranscript('')
  }, [setState, setError, setLiveTranscript])

  const stopConversation = useCallback(() => {
    conversationFlow.reset()
    setSpeaking(false)
    setCurrentAudioBlob(null)
  }, [conversationFlow, setSpeaking, setCurrentAudioBlob])

  return {
    state: coreState.status,
    messages: coreState.messages,
    processConversation,
    startListening,
    stopConversation,
    isActive: coreState.status !== 'idle'
  }
}

// Helper function to get current user ID
// This would need to be implemented based on your authentication system
async function getCurrentUserId(): Promise<string> {
  // For now, return a placeholder - this would integrate with your Supabase auth
  const response = await fetch('/api/auth/user')
  const { user } = await response.json()
  return user.id
}
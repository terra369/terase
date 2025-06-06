/**
 * useDiary Hook - Centralized Diary Operations
 * 
 * Consolidates diary CRUD operations, state management, and real-time subscriptions
 * into a single, reusable hook for consistent diary data handling across the app.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { typedAPIClient } from '../lib/apiClient';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { ErrorHandler } from '@/lib/errorHandling';

// Unified data types for diary operations
export interface DiaryMessage {
  id: number;
  diary_id: number;
  role: 'user' | 'ai';
  text: string;
  audio_url?: string | null;
  created_at: string;
  signed?: string | null;
}

export interface Diary {
  id: number;
  date: string;
  user_id: string;
  visibility: 'friends' | 'private';
  created_at: string;
}

export interface DiaryWithMessages extends Diary {
  messages: DiaryMessage[];
}

// Input types for diary operations
export interface CreateDiaryData {
  date: string;
  text: string;
  audioPath?: string;
  visibility?: 'friends' | 'private';
}

export interface UpdateDiaryData {
  text?: string;
  visibility?: 'friends' | 'private';
}

export interface AddMessageData {
  diaryId: number;
  role: 'user' | 'ai';
  text: string;
  audioUrl?: string;
  triggerAI?: boolean;
}

export function useDiary() {
  // Core diary state
  const [diary, setDiary] = useState<Diary | null>(null);
  const [messages, setMessages] = useState<DiaryMessage[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Real-time subscription
  const currentDiaryRef = useRef<Diary | null>(null);
  const subscriptionRef = useRef<any>(null);
  const currentDateRef = useRef<string | null>(null);

  // Helper function to clear error
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // Helper function to setup real-time subscription
  const setupRealtimeSubscription = useCallback((diaryId: number) => {
    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabaseBrowser.removeChannel(subscriptionRef.current);
    }

    const channel = supabaseBrowser
      .channel(`diary-messages-${diaryId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'diary_messages',
          filter: `diary_id=eq.${diaryId}`
        },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              setMessages(prev => {
                const newMessage = payload.new as DiaryMessage;
                // Check if message already exists to avoid duplicates
                if (prev.find(msg => msg.id === newMessage.id)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
              break;
            
            case 'UPDATE':
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === payload.new.id 
                    ? { ...msg, ...payload.new } as DiaryMessage
                    : msg
                )
              );
              break;
            
            case 'DELETE':
              setMessages(prev => 
                prev.filter(msg => msg.id !== payload.old.id)
              );
              break;
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
  }, []);

  // Create a new diary
  const createDiary = useCallback(async (data: CreateDiaryData): Promise<number> => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await typedAPIClient.saveDiary({
        date: data.date,
        text: data.text,
        audioPath: data.audioPath,
        visibility: data.visibility || 'friends'
      });

      if (response.diaryId) {
        return response.diaryId;
      } else {
        throw new Error('日記の作成に失敗しました');
      }
    } catch (err) {
      const errorHandler = ErrorHandler.fromUnknown(err, 'diary');
      errorHandler.log();
      setError(errorHandler.getUserMessage());
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  // Update an existing diary
  const updateDiary = useCallback(async (diaryId: number, data: UpdateDiaryData): Promise<void> => {
    setIsUpdating(true);
    setError(null);

    try {
      await typedAPIClient.saveDiary({
        diaryId,
        ...data
      });

      // Update local state if this is the currently loaded diary
      if (diary?.id === diaryId) {
        setDiary(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (err) {
      const errorHandler = ErrorHandler.fromUnknown(err, 'diary');
      errorHandler.log();
      setError(errorHandler.getUserMessage());
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [diary]);

  // Delete a diary
  const deleteDiary = useCallback(async (diaryId: number): Promise<void> => {
    setIsDeleting(true);
    setError(null);

    try {
      await typedAPIClient.deleteDiary(diaryId);

      // Clear local state if this was the currently loaded diary
      if (diary?.id === diaryId) {
        setDiary(null);
        setMessages([]);
        // Clean up subscription
        if (subscriptionRef.current) {
          supabaseBrowser.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }
      }
    } catch (err) {
      const errorHandler = ErrorHandler.fromUnknown(err, 'diary');
      errorHandler.log();
      setError(errorHandler.getUserMessage());
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [diary]);

  // Get diary by date
  const getDiary = useCallback(async (date: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    currentDateRef.current = date;

    try {
      const response = await typedAPIClient.getDiary(date);
      
      if (response) {
        const { messages: diaryMessages, ...diaryData } = response;
        setDiary(diaryData);
        setMessages(diaryMessages || []);
        currentDiaryRef.current = diaryData;
        
        // Setup real-time subscription for this diary
        setupRealtimeSubscription(diaryData.id);
      } else {
        // No diary found for this date
        setDiary(null);
        setMessages([]);
        currentDiaryRef.current = null;
        
        // Clean up subscription
        if (subscriptionRef.current) {
          supabaseBrowser.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }
      }
    } catch (err) {
      const errorHandler = ErrorHandler.fromUnknown(err, 'diary');
      errorHandler.log();
      setError(errorHandler.getUserMessage());
    } finally {
      setIsLoading(false);
    }
  }, [setupRealtimeSubscription]);

  // Get today's diary
  const getTodayDiary = useCallback(async (): Promise<void> => {
    const today = new Date().toISOString().slice(0, 10);
    return getDiary(today);
  }, [getDiary]);

  // Add message to diary
  const addMessage = useCallback(async (data: AddMessageData): Promise<void> => {
    setError(null);

    try {
      await typedAPIClient.saveDiaryMessage({
        diaryId: data.diaryId,
        role: data.role,
        text: data.text,
        audioUrl: data.audioUrl || null,
        triggerAI: data.triggerAI || false
      });

      // Real-time subscription will handle updating local state
    } catch (err) {
      const errorHandler = ErrorHandler.fromUnknown(err, 'diary');
      errorHandler.log();
      setError(errorHandler.getUserMessage());
      throw err;
    }
  }, []);

  // Refresh current diary data
  const refresh = useCallback(async (): Promise<void> => {
    if (currentDateRef.current) {
      return getDiary(currentDateRef.current);
    }
  }, [getDiary]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        supabaseBrowser.removeChannel(subscriptionRef.current);
      }
    };
  }, []);

  return {
    // State
    diary,
    messages,
    isLoading,
    error,
    isCreating,
    isUpdating,
    isDeleting,

    // Methods
    createDiary,
    updateDiary,
    deleteDiary,
    getDiary,
    getTodayDiary,
    addMessage,
    clearError,
    refresh
  };
}
/**
 * useDiary Hook Test Suite
 * 
 * Tests for centralized diary operations hook that consolidates:
 * - Diary CRUD operations (create, read, update, delete)
 * - State management for diary data and loading states
 * - Real-time subscriptions for diary updates
 * - Integration with existing API client and error handling
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDiary } from './useDiary';
import { typedAPIClient } from '../lib/apiClient';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { ErrorHandler } from '@/lib/errorHandling';

// Mock dependencies
vi.mock('../lib/apiClient');
vi.mock('@/lib/supabase/browser');
vi.mock('@/lib/errorHandling');

const mockTypedAPIClient = typedAPIClient as unknown as {
  getDiary: Mock;
  getDiaries: Mock;
  saveDiary: Mock;
  saveDiaryMessage: Mock;
  getDiaryMessages: Mock;
};

const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn()
  },
  channel: vi.fn(),
  removeChannel: vi.fn()
};

(supabaseBrowser as any) = mockSupabase;

const mockErrorHandler = {
  log: vi.fn(),
  getUserMessage: vi.fn(() => 'エラーが発生しました'),
  isRetryable: vi.fn(() => false)
};

(ErrorHandler.fromUnknown as Mock).mockReturnValue(mockErrorHandler);

// Test data
const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockDiary = {
  id: 1,
  date: '2025-06-06',
  user_id: 'user-123',
  visibility: 'friends' as const,
  created_at: '2025-06-06T10:00:00Z'
};

const mockDiaryMessage = {
  id: 1,
  diary_id: 1,
  role: 'user' as const,
  text: 'テストメッセージ',
  audio_url: '/audio/test.wav',
  created_at: '2025-06-06T10:00:00Z'
};

const mockDiaryWithMessages = {
  ...mockDiary,
  messages: [mockDiaryMessage]
};

describe('useDiary Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    // Default real-time channel mock
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn()
    };
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
    });
    mockSupabase.channel.mockReturnValue(mockChannel);
  });

  describe('Hook Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useDiary());

      expect(result.current.diary).toBe(null);
      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isDeleting).toBe(false);
    });

    it('should provide all expected methods', () => {
      const { result } = renderHook(() => useDiary());

      expect(typeof result.current.createDiary).toBe('function');
      expect(typeof result.current.updateDiary).toBe('function');
      expect(typeof result.current.deleteDiary).toBe('function');
      expect(typeof result.current.getDiary).toBe('function');
      expect(typeof result.current.getTodayDiary).toBe('function');
      expect(typeof result.current.addMessage).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('Diary CRUD Operations', () => {
    describe('createDiary', () => {
      it('should create a new diary successfully', async () => {
        mockTypedAPIClient.saveDiary.mockResolvedValue({
          diaryId: 1,
          success: true
        });

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          const diaryId = await result.current.createDiary({
            date: '2025-06-06',
            text: 'テスト日記',
            audioPath: '/audio/test.wav'
          });
          expect(diaryId).toBe(1);
        });

        expect(result.current.isCreating).toBe(false);
        expect(result.current.error).toBe(null);
        expect(mockTypedAPIClient.saveDiary).toHaveBeenCalledWith({
          date: '2025-06-06',
          text: 'テスト日記',
          audioPath: '/audio/test.wav'
        });
      });

      it('should handle create diary errors', async () => {
        const error = new Error('作成に失敗しました');
        mockTypedAPIClient.saveDiary.mockRejectedValue(error);

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await expect(result.current.createDiary({
            date: '2025-06-06',
            text: 'テスト日記'
          })).rejects.toThrow('作成に失敗しました');
        });

        expect(result.current.isCreating).toBe(false);
        expect(result.current.error).toBe('エラーが発生しました');
        expect(mockErrorHandler.log).toHaveBeenCalled();
      });

      it('should set loading state during creation', async () => {
        let resolvePromise: (value: any) => void;
        const pendingPromise = new Promise(resolve => {
          resolvePromise = resolve;
        });
        mockTypedAPIClient.saveDiary.mockReturnValue(pendingPromise);

        const { result } = renderHook(() => useDiary());

        act(() => {
          result.current.createDiary({
            date: '2025-06-06',
            text: 'テスト日記'
          });
        });

        expect(result.current.isCreating).toBe(true);

        act(() => {
          resolvePromise!({ diaryId: 1 });
        });

        await waitFor(() => {
          expect(result.current.isCreating).toBe(false);
        });
      });
    });

    describe('updateDiary', () => {
      it('should update existing diary successfully', async () => {
        mockTypedAPIClient.saveDiary.mockResolvedValue({
          diaryId: 1,
          success: true
        });

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await result.current.updateDiary(1, {
            text: '更新されたテキスト',
            visibility: 'private'
          });
        });

        expect(result.current.isUpdating).toBe(false);
        expect(result.current.error).toBe(null);
        expect(mockTypedAPIClient.saveDiary).toHaveBeenCalledWith({
          diaryId: 1,
          text: '更新されたテキスト',
          visibility: 'private'
        });
      });

      it('should handle update diary errors', async () => {
        const error = new Error('更新に失敗しました');
        mockTypedAPIClient.saveDiary.mockRejectedValue(error);

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await expect(result.current.updateDiary(1, {
            text: '更新テキスト'
          })).rejects.toThrow('更新に失敗しました');
        });

        expect(result.current.error).toBe('エラーが発生しました');
      });
    });

    describe('deleteDiary', () => {
      it('should delete diary successfully', async () => {
        // Mock delete API call (assuming we'll add this to apiClient)
        const mockDelete = vi.fn().mockResolvedValue({ success: true });
        mockTypedAPIClient.deleteDiary = mockDelete;

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await result.current.deleteDiary(1);
        });

        expect(result.current.isDeleting).toBe(false);
        expect(result.current.diary).toBe(null);
        expect(result.current.messages).toEqual([]);
        expect(mockDelete).toHaveBeenCalledWith(1);
      });

      it('should handle delete diary errors', async () => {
        const error = new Error('削除に失敗しました');
        const mockDelete = vi.fn().mockRejectedValue(error);
        mockTypedAPIClient.deleteDiary = mockDelete;

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await expect(result.current.deleteDiary(1)).rejects.toThrow('削除に失敗しました');
        });

        expect(result.current.error).toBe('エラーが発生しました');
      });
    });
  });

  describe('Diary Fetching', () => {
    describe('getDiary', () => {
      it('should fetch diary by date successfully', async () => {
        mockTypedAPIClient.getDiary.mockResolvedValue(mockDiaryWithMessages);

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await result.current.getDiary('2025-06-06');
        });

        expect(result.current.diary).toEqual(mockDiary);
        expect(result.current.messages).toEqual([mockDiaryMessage]);
        expect(result.current.isLoading).toBe(false);
        expect(mockTypedAPIClient.getDiary).toHaveBeenCalledWith('2025-06-06');
      });

      it('should handle getDiary errors', async () => {
        const error = new Error('取得に失敗しました');
        mockTypedAPIClient.getDiary.mockRejectedValue(error);

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await result.current.getDiary('2025-06-06');
        });

        expect(result.current.error).toBe('エラーが発生しました');
        expect(result.current.isLoading).toBe(false);
      });
    });

    describe('getTodayDiary', () => {
      it('should fetch today\'s diary successfully', async () => {
        const today = new Date().toISOString().slice(0, 10);
        mockTypedAPIClient.getDiary.mockResolvedValue(mockDiaryWithMessages);

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await result.current.getTodayDiary();
        });

        expect(result.current.diary).toEqual(mockDiary);
        expect(mockTypedAPIClient.getDiary).toHaveBeenCalledWith(today);
      });

      it('should handle when no diary exists for today', async () => {
        mockTypedAPIClient.getDiary.mockResolvedValue(null);

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await result.current.getTodayDiary();
        });

        expect(result.current.diary).toBe(null);
        expect(result.current.messages).toEqual([]);
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('Message Operations', () => {
    describe('addMessage', () => {
      it('should add message to diary successfully', async () => {
        mockTypedAPIClient.saveDiaryMessage.mockResolvedValue({
          id: 2,
          success: true
        });
        mockTypedAPIClient.getDiary.mockResolvedValue(mockDiaryWithMessages);

        const { result } = renderHook(() => useDiary());

        // Set up initial diary state by loading it first
        await act(async () => {
          await result.current.getDiary('2025-06-06');
        });

        await act(async () => {
          await result.current.addMessage({
            diaryId: 1,
            role: 'user',
            text: '新しいメッセージ',
            audioUrl: '/audio/new.wav'
          });
        });

        expect(mockTypedAPIClient.saveDiaryMessage).toHaveBeenCalledWith({
          diaryId: 1,
          role: 'user',
          text: '新しいメッセージ',
          audioUrl: '/audio/new.wav',
          triggerAI: false
        });
      });

      it('should handle addMessage errors', async () => {
        const error = new Error('メッセージ保存に失敗しました');
        mockTypedAPIClient.saveDiaryMessage.mockRejectedValue(error);

        const { result } = renderHook(() => useDiary());

        await act(async () => {
          await expect(result.current.addMessage({
            diaryId: 1,
            role: 'user',
            text: 'テストメッセージ'
          })).rejects.toThrow('メッセージ保存に失敗しました');
        });

        expect(result.current.error).toBe('エラーが発生しました');
      });
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should set up real-time subscription when diary is loaded', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn()
      };
      mockSupabase.channel.mockReturnValue(mockChannel);
      mockTypedAPIClient.getDiary.mockResolvedValue(mockDiaryWithMessages);

      const { result } = renderHook(() => useDiary());

      await act(async () => {
        await result.current.getDiary('2025-06-06');
      });

      expect(mockSupabase.channel).toHaveBeenCalledWith(`diary-messages-${mockDiary.id}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'diary_messages',
          filter: `diary_id=eq.${mockDiary.id}`
        }),
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle real-time message updates', async () => {
      const mockChannel = {
        on: vi.fn(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn()
      };
      let realtimeCallback: (payload: any) => void;
      
      mockChannel.on.mockImplementation((event, config, callback) => {
        realtimeCallback = callback;
        return mockChannel;
      });
      
      mockSupabase.channel.mockReturnValue(mockChannel);
      mockTypedAPIClient.getDiary.mockResolvedValue(mockDiaryWithMessages);

      const { result } = renderHook(() => useDiary());

      await act(async () => {
        await result.current.getDiary('2025-06-06');
      });

      // Simulate real-time insert
      const newMessage = {
        id: 2,
        diary_id: 1,
        role: 'ai' as const,
        text: 'AIの返答',
        audio_url: null,
        created_at: '2025-06-06T10:05:00Z'
      };

      act(() => {
        realtimeCallback!({
          eventType: 'INSERT',
          new: newMessage,
          old: null
        });
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1]).toEqual(newMessage);
    });

    it('should clean up subscription on unmount', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn()
      };
      mockSupabase.channel.mockReturnValue(mockChannel);

      const { unmount } = renderHook(() => useDiary());

      unmount();

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('Error Handling and State Management', () => {
    it('should clear error when clearError is called', () => {
      const { result } = renderHook(() => useDiary());

      // Set an error
      act(() => {
        result.current.error = 'テストエラー';
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });

    it('should refresh diary data when refresh is called', async () => {
      mockTypedAPIClient.getDiary.mockResolvedValue(mockDiaryWithMessages);

      const { result } = renderHook(() => useDiary());

      // Load initial data
      await act(async () => {
        await result.current.getDiary('2025-06-06');
      });

      // Clear the mock call history
      mockTypedAPIClient.getDiary.mockClear();

      // Call refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(mockTypedAPIClient.getDiary).toHaveBeenCalledWith('2025-06-06');
    });

    it('should integrate with ErrorHandler for consistent error processing', async () => {
      const error = new Error('ネットワークエラー');
      mockTypedAPIClient.getDiary.mockRejectedValue(error);

      const { result } = renderHook(() => useDiary());

      await act(async () => {
        await result.current.getDiary('2025-06-06');
      });

      expect(ErrorHandler.fromUnknown).toHaveBeenCalledWith(error, 'diary');
      expect(mockErrorHandler.log).toHaveBeenCalled();
      expect(result.current.error).toBe('エラーが発生しました');
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should work with existing TypedAPIClient interface', async () => {
      mockTypedAPIClient.getDiaries.mockResolvedValue([mockDiary]);

      const { result } = renderHook(() => useDiary());

      // Test that we can still use existing API client methods
      expect(mockTypedAPIClient.getDiaries).toBeDefined();
      expect(mockTypedAPIClient.saveDiary).toBeDefined();
      expect(mockTypedAPIClient.saveDiaryMessage).toBeDefined();
    });

    it('should maintain backward compatibility with useConversation patterns', async () => {
      const { result } = renderHook(() => useDiary());

      // Test that the hook provides similar methods to useConversation
      expect(typeof result.current.createDiary).toBe('function'); // equivalent to ensureTodayDiary
      expect(typeof result.current.addMessage).toBe('function'); // equivalent to saveMessageToDiary
    });
  });

  describe('Type Safety and Data Consistency', () => {
    it('should enforce consistent DiaryMessage interface', () => {
      const { result } = renderHook(() => useDiary());

      // Test that messages array has consistent type
      expect(result.current.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            diary_id: expect.any(Number),
            role: expect.stringMatching(/^(user|ai)$/),
            text: expect.any(String),
            created_at: expect.any(String)
          })
        ])
      );
    });

    it('should handle optional fields correctly', async () => {
      const messageWithoutAudio = {
        ...mockDiaryMessage,
        audio_url: null
      };

      const diaryData = {
        ...mockDiary,
        messages: [messageWithoutAudio]
      };

      mockTypedAPIClient.getDiary.mockResolvedValue(diaryData);

      const { result } = renderHook(() => useDiary());

      await act(async () => {
        await result.current.getDiary('2025-06-06');
      });

      expect(result.current.messages[0].audio_url).toBe(null);
    });
  });
});
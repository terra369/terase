import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Supabase client
vi.mock('@/lib/supabase/browser', () => ({
  supabaseBrowser: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() }))
      })),
    })),
  }
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Web APIs that might not be available in test environment
Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})

// Add static method mock
Object.defineProperty(window.MediaRecorder, 'isTypeSupported', {
  writable: true,
  value: vi.fn().mockReturnValue(true),
})

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([{
        stop: vi.fn()
      }]),
      active: true
    }),
  },
})

// Mock AudioContext for audio recording
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    state: 'running',
    currentTime: 0,
    createOscillator: vi.fn().mockReturnValue({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
    }),
    createGain: vi.fn().mockReturnValue({
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn() },
    }),
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
  })),
})
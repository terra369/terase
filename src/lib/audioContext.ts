'use client'

const AUDIO_CONTEXT_PERMISSION_KEY = 'terase_audio_context_permission_granted'

// グローバルなAudioContextインスタンス
let globalAudioContext: AudioContext | null = null

export function isAudioContextPermissionGranted(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(AUDIO_CONTEXT_PERMISSION_KEY) === 'true'
}

export function setAudioContextPermissionGranted() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUDIO_CONTEXT_PERMISSION_KEY, 'true')
  }
}

export async function initializeAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null
  
  try {
    // 既存のAudioContextがあり、正常に動作している場合はそれを返す
    if (globalAudioContext && globalAudioContext.state !== 'closed') {
      if (globalAudioContext.state === 'suspended') {
        await globalAudioContext.resume()
      }
      return globalAudioContext
    }

    // 新しいAudioContextを作成
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    globalAudioContext = new AudioContextClass()
    
    // suspendedの場合はresumeを試行
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume()
    }
    
    return globalAudioContext
  } catch (error) {
    console.error('Failed to initialize AudioContext:', error)
    return null
  }
}

export async function ensureAudioContextRunning(): Promise<boolean> {
  try {
    const audioContext = await initializeAudioContext()
    if (!audioContext) return false
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    
    return audioContext.state === 'running'
  } catch (error) {
    console.error('Failed to ensure AudioContext is running:', error)
    return false
  }
}

export function getAudioContext(): AudioContext | null {
  return globalAudioContext
}

// 初回ユーザーインタラクション時にAudioContextを初期化し、権限を記録
export async function handleFirstUserInteraction(): Promise<boolean> {
  try {
    // AudioContextを初期化
    const audioContext = await initializeAudioContext()
    if (!audioContext) return false
    
    // 成功したら権限を記録
    setAudioContextPermissionGranted()
    
    // ダミーの音声を再生してブラウザの音声許可を確実にする（モバイル対応）
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // 無音に近い音量で短時間再生（モバイルでも確実に動作するように少し長めに）
    gainNode.gain.setValueAtTime(0.001, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1) // 0.1秒に延長
    
    // モバイルブラウザでの確実な初期化のため少し待機
    await new Promise(resolve => setTimeout(resolve, 50))
    
    return true
  } catch (error) {
    console.error('Failed to handle first user interaction:', error)
    return false
  }
}
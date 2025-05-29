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
    
    // iOS Safariの検出
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    
    // ダミーの音声を再生してブラウザの音声許可を確実にする
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // iOS Safariでは少し長めの再生時間と音量を設定
    const duration = isIOS && isSafari ? 0.25 : 0.1
    const volume = isIOS && isSafari ? 0.01 : 0.001
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration)
    
    // iOS Safariでは長めに待機
    const waitTime = isIOS && isSafari ? 200 : 50
    await new Promise(resolve => setTimeout(resolve, waitTime))
    
    // iOS Safariでは追加の確認を行う
    if (isIOS && isSafari) {
      // AudioContextが正常に動作しているか再確認
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      // 少し待機してから最終確認
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (audioContext.state !== 'running') {
        console.warn('AudioContext is not running after initialization on iOS Safari')
        return false
      }
    }
    
    // 成功したら権限を記録
    setAudioContextPermissionGranted()
    
    return true
  } catch (error) {
    console.error('Failed to handle first user interaction:', error)
    return false
  }
}
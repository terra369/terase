'use client'

import { logAudioDebug } from './audioDebug'

// グローバルなAudioContextインスタンス
let globalAudioContext: AudioContext | null = null

export async function initializeAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null
  
  try {
    // 既存のAudioContextがあり、正常に動作している場合はそれを返す
    if (globalAudioContext && globalAudioContext.state !== 'closed') {
      logAudioDebug({
        audioContextState: globalAudioContext.state,
        error: 'Using existing AudioContext'
      })
      
      if (globalAudioContext.state === 'suspended') {
        await globalAudioContext.resume()
        logAudioDebug({
          audioContextState: globalAudioContext.state,
          error: 'Resumed existing AudioContext'
        })
      }
      return globalAudioContext
    }

    // 新しいAudioContextを作成
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    globalAudioContext = new AudioContextClass()
    
    logAudioDebug({
      audioContextState: globalAudioContext.state,
      error: 'Created new AudioContext'
    })
    
    // suspendedの場合はresumeを試行
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume()
      logAudioDebug({
        audioContextState: globalAudioContext.state,
        error: 'Resumed new AudioContext'
      })
    }
    
    return globalAudioContext
  } catch (error) {
    console.error('Failed to initialize AudioContext:', error)
    logAudioDebug({
      error: `Failed to initialize AudioContext: ${error}`
    })
    return null
  }
}

export async function ensureAudioContextRunning(): Promise<boolean> {
  try {
    const audioContext = await initializeAudioContext()
    if (!audioContext) return false
    
    // iOS Safariの検出
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    
    // iOSの場合、より積極的にresumeを試みる
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
      
      if (isIOS && isSafari) {
        // iOS Safariの場合は長めに待機
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // まだsuspendedの場合は再度resume
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
          // さらに待機
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // 最終確認
        if (audioContext.state === 'suspended') {
          console.warn('AudioContext remains suspended on iOS Safari after multiple attempts');
          // iOS Safariではこれ以上試しても意味がないので、trueを返す
          return true; // 処理を続行させる
        }
      }
    }
    
    // iOS Safariでは、suspendedでも処理を続行
    if (isIOS && isSafari && audioContext.state === 'suspended') {
      console.log('Proceeding with suspended AudioContext on iOS Safari');
      return true;
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
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    
    // ダミーの音声を再生してブラウザの音声許可を確実にする
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // iOS Safariでは少し長めの再生時間と音量を設定
    const duration = isIOS && isSafari ? 0.5 : 0.1 // iOS Safariではさらに長く
    const volume = isIOS && isSafari ? 0.001 : 0.00001 // iOS Safariでは少し大きめの音量
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration)
    
    // iOS Safariでは長めに待機
    const waitTime = isIOS && isSafari ? 300 : 50
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
    
    return true
  } catch (error) {
    console.error('Failed to handle first user interaction:', error)
    return false
  }
}
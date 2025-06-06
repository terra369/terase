'use client'

import { getAudioContext } from './audioContext'

let keepAliveInterval: NodeJS.Timeout | null = null
let silentOscillator: OscillatorNode | null = null
let silentGain: GainNode | null = null

/**
 * AudioContextをアクティブに保つための仕組み
 * iOS Safariなどで音声が自動的にサスペンドされるのを防ぐ
 */
export function startAudioKeepAlive() {
  if (typeof window === 'undefined') return
  
  // 既に実行中の場合は何もしない
  if (keepAliveInterval) return
  
  const audioContext = getAudioContext()
  if (!audioContext) return
  
  // 無音のオシレーターを作成
  try {
    silentOscillator = audioContext.createOscillator()
    silentGain = audioContext.createGain()
    
    // 完全に無音に設定
    silentGain.gain.value = 0
    
    silentOscillator.connect(silentGain)
    silentGain.connect(audioContext.destination)
    
    // 無音のオシレーターを開始
    silentOscillator.start()
    
    // 定期的にAudioContextの状態をチェック
    keepAliveInterval = setInterval(async () => {
      const ctx = getAudioContext()
      if (ctx && ctx.state === 'suspended') {
        console.log('AudioContext suspended, resuming...')
        try {
          await ctx.resume()
        } catch (error) {
          console.error('Failed to resume AudioContext:', error)
        }
      }
    }, 1000) // 1秒ごとにチェック
    
    console.log('Audio keep-alive started')
  } catch (error) {
    console.error('Failed to start audio keep-alive:', error)
    stopAudioKeepAlive()
  }
}

/**
 * AudioContextのキープアライブを停止
 */
export function stopAudioKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
  
  if (silentOscillator) {
    try {
      silentOscillator.stop()
      silentOscillator.disconnect()
    } catch (error) {
      // 既に停止している場合はエラーを無視
    }
    silentOscillator = null
  }
  
  if (silentGain) {
    try {
      silentGain.disconnect()
    } catch (error) {
      // 既に切断されている場合はエラーを無視
    }
    silentGain = null
  }
  
  console.log('Audio keep-alive stopped')
}
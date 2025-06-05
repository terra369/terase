/**
 * Platform-agnostic audio recording state machine
 * Core state management for Web/React Native reusability
 */

import type { RecordingState, RecordingSession, AudioBlob } from './types'

export interface StateTransition {
  from: RecordingState
  to: RecordingState
  trigger: string
  condition?: () => boolean
}

export interface StateTransitionEvent {
  trigger: string
  data?: any
}

export class AudioRecordingStateMachine {
  private currentState: RecordingState = 'idle'
  private currentSession: RecordingSession | null = null
  private transitions: StateTransition[] = []
  private listeners: Map<RecordingState, Array<(session: RecordingSession) => void>> = new Map()

  constructor() {
    this.setupTransitions()
  }

  private setupTransitions(): void {
    this.transitions = [
      // From idle
      { from: 'idle', to: 'requesting-permission', trigger: 'REQUEST_PERMISSION' },
      { from: 'idle', to: 'recording', trigger: 'START_RECORDING' },

      // From requesting permission
      { from: 'requesting-permission', to: 'recording', trigger: 'PERMISSION_GRANTED' },
      { from: 'requesting-permission', to: 'error', trigger: 'PERMISSION_DENIED' },
      { from: 'requesting-permission', to: 'idle', trigger: 'CANCEL' },

      // From recording
      { from: 'recording', to: 'processing', trigger: 'STOP_RECORDING' },
      { from: 'recording', to: 'error', trigger: 'RECORDING_ERROR' },
      { from: 'recording', to: 'idle', trigger: 'CANCEL' },

      // From processing
      { from: 'processing', to: 'completed', trigger: 'PROCESSING_COMPLETE' },
      { from: 'processing', to: 'error', trigger: 'PROCESSING_ERROR' },

      // From completed
      { from: 'completed', to: 'idle', trigger: 'RESET' },

      // From error
      { from: 'error', to: 'idle', trigger: 'RESET' },
      { from: 'error', to: 'requesting-permission', trigger: 'RETRY' },
    ]
  }

  getCurrentState(): RecordingState {
    return this.currentState
  }

  getCurrentSession(): RecordingSession | null {
    return this.currentSession
  }

  isRecording(): boolean {
    return this.currentState === 'recording'
  }

  isProcessing(): boolean {
    return this.currentState === 'processing'
  }

  canStart(): boolean {
    return this.currentState === 'idle'
  }

  canStop(): boolean {
    return this.currentState === 'recording'
  }

  transition(event: StateTransitionEvent): boolean {
    const validTransition = this.transitions.find(
      t => t.from === this.currentState && 
           t.trigger === event.trigger &&
           (!t.condition || t.condition())
    )

    if (!validTransition) {
      console.warn(`Invalid transition: ${this.currentState} -> ${event.trigger}`)
      return false
    }

    const previousState = this.currentState
    this.currentState = validTransition.to

    // Handle state-specific logic
    this.handleStateChange(previousState, validTransition.to, event.data)

    // Notify listeners
    this.notifyListeners(validTransition.to)

    return true
  }

  private handleStateChange(
    from: RecordingState, 
    to: RecordingState, 
    data?: any
  ): void {
    switch (to) {
      case 'requesting-permission':
        // Create new session when requesting permission
        this.currentSession = {
          id: this.generateSessionId(),
          startTime: new Date(),
          state: to,
        }
        break

      case 'recording':
        if (this.currentSession) {
          this.currentSession.state = to
          this.currentSession.startTime = new Date()
        } else {
          // Direct start without permission request
          this.currentSession = {
            id: this.generateSessionId(),
            startTime: new Date(),
            state: to,
          }
        }
        break

      case 'processing':
        if (this.currentSession) {
          this.currentSession.state = to
          this.currentSession.endTime = new Date()
        }
        break

      case 'completed':
        if (this.currentSession && data?.audioBlob) {
          this.currentSession.state = to
          this.currentSession.audioBlob = data.audioBlob
        }
        break

      case 'error':
        if (this.currentSession) {
          this.currentSession.state = to
          this.currentSession.error = data?.error || 'Unknown error'
          this.currentSession.endTime = new Date()
        }
        break

      case 'idle':
        // Keep session for reference but mark as completed
        if (this.currentSession && from !== 'error') {
          this.currentSession.state = 'completed'
        }
        break
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private notifyListeners(state: RecordingState): void {
    const stateListeners = this.listeners.get(state)
    if (stateListeners && this.currentSession) {
      stateListeners.forEach(listener => listener(this.currentSession!))
    }
  }

  // Event helper methods
  requestPermission(): boolean {
    return this.transition({ trigger: 'REQUEST_PERMISSION' })
  }

  startRecording(): boolean {
    return this.transition({ trigger: 'START_RECORDING' })
  }

  stopRecording(): boolean {
    return this.transition({ trigger: 'STOP_RECORDING' })
  }

  permissionGranted(): boolean {
    return this.transition({ trigger: 'PERMISSION_GRANTED' })
  }

  permissionDenied(): boolean {
    return this.transition({ trigger: 'PERMISSION_DENIED' })
  }

  recordingError(error: string): boolean {
    return this.transition({ trigger: 'RECORDING_ERROR', data: { error } })
  }

  processingComplete(audioBlob: AudioBlob): boolean {
    return this.transition({ trigger: 'PROCESSING_COMPLETE', data: { audioBlob } })
  }

  processingError(error: string): boolean {
    return this.transition({ trigger: 'PROCESSING_ERROR', data: { error } })
  }

  reset(): boolean {
    return this.transition({ trigger: 'RESET' })
  }

  retry(): boolean {
    return this.transition({ trigger: 'RETRY' })
  }

  cancel(): boolean {
    return this.transition({ trigger: 'CANCEL' })
  }

  // Listener management
  onStateChange(state: RecordingState, callback: (session: RecordingSession) => void): void {
    if (!this.listeners.has(state)) {
      this.listeners.set(state, [])
    }
    this.listeners.get(state)!.push(callback)
  }

  removeStateListener(state: RecordingState, callback: (session: RecordingSession) => void): void {
    const stateListeners = this.listeners.get(state)
    if (stateListeners) {
      const index = stateListeners.indexOf(callback)
      if (index > -1) {
        stateListeners.splice(index, 1)
      }
    }
  }

  clearListeners(): void {
    this.listeners.clear()
  }

  // Utility methods
  getRecordingDuration(): number {
    if (!this.currentSession || !this.currentSession.startTime) {
      return 0
    }

    const endTime = this.currentSession.endTime || new Date()
    return endTime.getTime() - this.currentSession.startTime.getTime()
  }

  getSessionHistory(): RecordingSession[] {
    // In a real implementation, this would return stored session history
    return this.currentSession ? [this.currentSession] : []
  }

  isInErrorState(): boolean {
    return this.currentState === 'error'
  }

  isInTerminalState(): boolean {
    return this.currentState === 'completed' || this.currentState === 'error'
  }

  canRetry(): boolean {
    return this.currentState === 'error'
  }
}

// Factory function for creating state machine instances
export const createRecordingStateMachine = (): AudioRecordingStateMachine => {
  return new AudioRecordingStateMachine()
}
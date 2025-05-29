import { useRef, useState, useEffect } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import { useConversationStore } from '@/stores/useConversationStore';

// Animation state interface
interface AnimationState {
  thinking: number;
  speaking: number;
  transition: number;
  speakingAfterEffect: number;
  thinkingFadeOut: number;
  previousState: string;
  thinkingToSpeakingProgress: number;
  thinkingToSpeakingStartFrame: number;
  thinkingPeakValue: number;
  energyFlow: number;
}

// Easing functions
const easeInOutCubic = (t: number) => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const easeOutQuart = (t: number) => 
  1 - Math.pow(1 - t, 4);

const easeInQuart = (t: number) => 
  t * t * t * t;

// Hook for managing BallBot animation state
export function useBallBotAnimation() {
  // Get audio amplitude and conversation state
  const amp = useAudioStore((s) => s.amp || 0);
  const state = useConversationStore((s) => s.state);
  const messages = useConversationStore((s) => s.messages);
  
  // Responsive scale management
  const [responsiveScale, setResponsiveScale] = useState(1);
  
  // Animation state
  const stateValues = useRef<AnimationState>({
    thinking: 0,
    speaking: 0,
    transition: 0,
    speakingAfterEffect: 0,
    thinkingFadeOut: 0,
    previousState: 'idle',
    thinkingToSpeakingProgress: 0,
    thinkingToSpeakingStartFrame: -1,
    thinkingPeakValue: 0,
    energyFlow: 0,
  });
  
  // Float animation phases
  const phaseX = useRef(Math.random() * Math.PI * 2);
  const phaseY = useRef(Math.random() * Math.PI * 2);
  const phaseZ = useRef(Math.random() * Math.PI * 2);
  
  // Speaking duration tracking
  const effectiveSpeakingRef = useRef(0);
  const speakingStartFrame = useRef(-1);
  const lastAIMessageId = useRef<string | null>(null);
  const currentSpeakingDuration = useRef(5);
  
  // Get last AI message
  const lastAIMessage = messages.filter(m => m.speaker === 'ai').pop();
  
  // Update responsive scale on window resize
  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setResponsiveScale(1.6); // Mobile
      } else if (width < 1024) {
        setResponsiveScale(1.5); // Tablet
      } else {
        setResponsiveScale(1.3); // Desktop
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
  
  // Update animation state (called in useFrame)
  const updateAnimation = () => {
    const targetThinking = (state === 'thinking' || state === 'transcribing') ? 1 : 0;
    const targetSpeaking = state === 'speaking' ? 1 : 0;
    const currentState = state;
    
    // Detect state transitions
    const isTransitioningFromThinkingToSpeaking = 
      stateValues.current.previousState === 'thinking' && currentState === 'speaking';
    
    // Handle thinking to speaking transition
    if (isTransitioningFromThinkingToSpeaking && stateValues.current.thinking > 0.3) {
      stateValues.current.thinkingToSpeakingStartFrame = 0;
      stateValues.current.thinkingPeakValue = stateValues.current.thinking;
      stateValues.current.thinkingFadeOut = stateValues.current.thinking;
    }
    
    // Manage transition animation
    if (stateValues.current.thinkingToSpeakingStartFrame >= 0) {
      stateValues.current.thinkingToSpeakingStartFrame++;
      
      const transitionDuration = 210; // ~3.5 seconds at 60fps
      const progress = Math.min(stateValues.current.thinkingToSpeakingStartFrame / transitionDuration, 1);
      stateValues.current.thinkingToSpeakingProgress = progress;
      
      // Transition phases
      if (progress < 0.3) {
        const phase1Progress = progress / 0.3;
        const gentleFade = easeInQuart(phase1Progress);
        stateValues.current.thinkingFadeOut = stateValues.current.thinkingPeakValue * (1 - gentleFade * 0.15);
        stateValues.current.energyFlow = gentleFade * 0.3;
      } else if (progress < 0.5) {
        const phase2Progress = (progress - 0.3) / 0.2;
        const smoothTransition = easeInOutCubic(phase2Progress);
        stateValues.current.thinkingFadeOut = stateValues.current.thinkingPeakValue * (0.85 - smoothTransition * 0.25);
        stateValues.current.energyFlow = 0.3 + smoothTransition * 0.3;
      } else if (progress < 0.8) {
        const phase3Progress = (progress - 0.5) / 0.3;
        const mainTransition = easeInOutCubic(phase3Progress);
        stateValues.current.thinkingFadeOut = stateValues.current.thinkingPeakValue * (0.6 - mainTransition * 0.4);
        stateValues.current.energyFlow = 0.6 + mainTransition * 0.3;
      } else {
        const phase4Progress = (progress - 0.8) / 0.2;
        const finalFade = easeOutQuart(phase4Progress);
        stateValues.current.thinkingFadeOut = stateValues.current.thinkingPeakValue * 0.2 * (1 - finalFade);
        stateValues.current.energyFlow = 0.9 * (1 - finalFade);
      }
      
      if (progress >= 1) {
        stateValues.current.thinkingToSpeakingStartFrame = -1;
        stateValues.current.thinkingFadeOut = 0;
        stateValues.current.energyFlow = 0;
      }
    }
    
    // Update thinking state
    const thinkingDiff = targetThinking - stateValues.current.thinking;
    const isTransitioning = stateValues.current.thinkingToSpeakingStartFrame >= 0;
    const thinkingSpeed = isTransitioning ? 0.02 : (Math.abs(thinkingDiff) > 0.1 ? 0.06 : 0.03);
    stateValues.current.thinking += thinkingDiff * thinkingSpeed;
    
    // Update previous state
    if (currentState !== stateValues.current.previousState) {
      stateValues.current.previousState = currentState;
    }
    
    // Update speaking state
    if (targetSpeaking > 0) {
      if (stateValues.current.thinkingToSpeakingProgress > 0.5) {
        const speakingPhaseProgress = (stateValues.current.thinkingToSpeakingProgress - 0.5) / 0.5;
        const targetSpeakingDuringTransition = easeInOutCubic(speakingPhaseProgress);
        stateValues.current.speaking += (targetSpeakingDuringTransition - stateValues.current.speaking) * 0.08;
      } else {
        const baseSpeed = stateValues.current.speaking < 0.5 ? 0.15 : 0.10;
        stateValues.current.speaking += (targetSpeaking - stateValues.current.speaking) * baseSpeed;
      }
    } else {
      const fadeOutSpeed = stateValues.current.speaking > 0.8 ? 0.02 : 0.04;
      stateValues.current.speaking += (targetSpeaking - stateValues.current.speaking) * fadeOutSpeed;
    }
    
    // Handle speaking duration tracking
    if (targetSpeaking > 0 && lastAIMessage && lastAIMessage.id !== lastAIMessageId.current) {
      const messageLength = lastAIMessage.content?.length || 0;
      currentSpeakingDuration.current = Math.max(4, messageLength * 0.6);
      
      lastAIMessageId.current = lastAIMessage.id;
      speakingStartFrame.current = 0;
      stateValues.current.speakingAfterEffect = 1;
    }
    
    // Manage speaking after-effect
    if (targetSpeaking > 0 || stateValues.current.speaking > 0.5) {
      stateValues.current.speakingAfterEffect = 1;
      if (speakingStartFrame.current >= 0) {
        speakingStartFrame.current++;
      }
    } else if (stateValues.current.speakingAfterEffect > 0 && speakingStartFrame.current >= 0) {
      speakingStartFrame.current++;
      
      const elapsedFrames = speakingStartFrame.current;
      const speakingFrameDuration = currentSpeakingDuration.current * 60;
      const progress = elapsedFrames / speakingFrameDuration;
      
      if (progress < 1.0) {
        if (progress < 0.9) {
          stateValues.current.speakingAfterEffect = 1.0;
        } else {
          const fadeProgress = (progress - 0.9) / 0.1;
          const easedFade = 1 - easeInOutCubic(fadeProgress);
          stateValues.current.speakingAfterEffect = easedFade;
        }
      } else {
        stateValues.current.speakingAfterEffect = 0;
        speakingStartFrame.current = -1;
      }
    }
    
    // Calculate effective values
    const effectiveSpeaking = Math.max(stateValues.current.speaking, stateValues.current.speakingAfterEffect);
    effectiveSpeakingRef.current = effectiveSpeaking;
    
    // Update transition value
    const targetTransition = Math.max(stateValues.current.thinking, effectiveSpeaking);
    stateValues.current.transition += (targetTransition - stateValues.current.transition) * 0.06;
    
    return {
      thinking: Math.max(stateValues.current.thinking, stateValues.current.thinkingFadeOut),
      speaking: effectiveSpeaking,
      transition: stateValues.current.transition,
      energyFlow: stateValues.current.energyFlow,
      amp,
      responsiveScale,
      phaseX: phaseX.current,
      phaseY: phaseY.current,
      phaseZ: phaseZ.current,
    };
  };
  
  return {
    updateAnimation,
    stateValues,
  };
}
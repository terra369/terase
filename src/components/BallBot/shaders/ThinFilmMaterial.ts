import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// Shader material for holographic bubble effect
export const ThinFilmMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmp: 0,
    uThinking: 0,
    uSpeaking: 0,
    uStateTransition: 0,
    uEnergyFlow: 0,
  },
  /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uAmp;
  uniform float uThinking;
  uniform float uSpeaking;
  uniform float uStateTransition;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vViewPosition;
  varying float vDisplacement;
  
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    vViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    
    // Holographic distortion (gentle)
    float t = uTime * 0.3;
    float waveX = sin(t * 0.4 + position.y * 2.0) * 0.005;
    float waveY = sin(t * 0.3 + position.x * 1.5) * 0.007;
    float waveZ = sin(t * 0.25 + position.z * 1.8) * 0.005;
    
    // Audio wave effect (subtle)
    float audioEffect = uAmp * 0.02;
    
    // Thinking neural pulse effect (gentle)
    float thinkingPulse = 0.0;
    if (uThinking > 0.0) {
      float pulseFreq = 3.0 + sin(uTime * 0.8) * 1.0;
      thinkingPulse = sin(uTime * pulseFreq + position.y * 5.0) * 0.015;
      thinkingPulse += sin(uTime * pulseFreq * 1.1 + position.x * 4.0) * 0.01;
      thinkingPulse *= uThinking;
    }
    
    // Speaking ripple effect (gentle)
    float speakingWave = 0.0;
    if (uSpeaking > 0.0) {
      float waveTime = uTime * 1.5;
      speakingWave = sin(length(position.xy) * 8.0 - waveTime) * 0.02;
      speakingWave += sin(length(position.xz) * 6.0 - waveTime * 0.5) * 0.015;
      speakingWave *= uSpeaking * (1.0 + uAmp * 0.5);
    }
    
    // Combine displacements
    float totalDisplacement = waveX + waveY + waveZ + audioEffect + thinkingPulse + speakingWave;
    vec3 displacement = normal * totalDisplacement;
    vec3 newPosition = position + displacement;
    
    vDisplacement = totalDisplacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }`,
  /* glsl */ `
  precision highp float;
  const float PI = 3.14159265359;
  uniform float uTime;
  uniform float uAmp;
  uniform float uThinking;
  uniform float uSpeaking;
  uniform float uStateTransition;
  uniform float uEnergyFlow;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vViewPosition;
  varying float vDisplacement;
  
  // HSL to RGB conversion
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }
  
  void main(){
    // Calculate Fresnel effect
    vec3 viewDir = normalize(-vViewPosition);
    float cosI = abs(dot(normalize(vNormal), viewDir));
    
    // Stronger Fresnel for edge emphasis
    float fresnel = pow(1.0 - cosI, 3.5);
    
    // Base rainbow effect (slow change)
    float baseHue = fract(vPos.y * 0.2 + vPos.x * 0.1 + uTime * 0.02);
    
    // Thinking: bright cyber blue (cyan)
    vec3 thinkingColor = hsl2rgb(vec3(0.5, 0.9, 0.75));
    
    // Speaking: bright gold-orange
    float speakingHue = fract(uTime * 0.1 + length(vPos.xy) * 0.2);
    vec3 speakingColor = hsl2rgb(vec3(0.08 + speakingHue * 0.1, 0.85, 0.7));
    
    // Normal rainbow (bright)
    vec3 rainbow = hsl2rgb(vec3(baseHue, 0.8, 0.7));
    
    // State-based color blending (smooth transition)
    vec3 stateColor = rainbow;
    
    // Special color during energy flow
    if (uEnergyFlow > 0.0) {
      // Color changes from blue(0.5) to gold(0.08) based on flow progress
      float flowHue = mix(0.5, 0.08, uEnergyFlow);
      vec3 transitionColor = hsl2rgb(vec3(flowHue, 0.8, 0.7));
      stateColor = mix(stateColor, transitionColor, uEnergyFlow * 0.4);
    }
    
    // Apply easing to blends
    float thinkingBlend = smoothstep(0.0, 1.0, uThinking);
    float speakingBlend = smoothstep(0.0, 1.0, uSpeaking);
    stateColor = mix(stateColor, thinkingColor, thinkingBlend);
    stateColor = mix(stateColor, speakingColor, speakingBlend);
    
    // Energy pulse effect (subtle)
    float energyPulse = 1.0;
    if (uThinking > 0.0) {
      // Complex pulse during thinking
      float thinkingPulse = sin(uTime * 4.0) * 0.1 + sin(uTime * 2.3) * 0.05;
      energyPulse += thinkingPulse * uThinking;
    }
    if (uSpeaking > 0.0) {
      // Dynamic pulse during speaking
      float speakingPulse = 0.2 + uAmp * 0.4 + sin(uTime * 1.5) * 0.1;
      energyPulse += speakingPulse * uSpeaking;
    }
    if (uEnergyFlow > 0.0) {
      // Wave pulse during energy flow
      float flowPulse = sin(uTime * 3.0 + vPos.y * 2.0) * 0.15 + sin(uTime * 5.0) * 0.1;
      energyPulse += flowPulse * uEnergyFlow;
    }
    
    // Edge effect that gets stronger (brighter)
    float rim = mix(0.3, 1.2, fresnel);
    // Center also brightens during thinking/speaking
    if (uThinking > 0.0) {
      rim = mix(rim, 1.0, uThinking * 0.7);
    }
    if (uSpeaking > 0.0) {
      rim = mix(rim, 1.0, uSpeaking * 0.7);
    }
    vec3 colour = stateColor * rim * energyPulse * (0.8 + uAmp * 0.8);
    
    // Additional glow from displacement (brighter)
    colour += vec3(abs(vDisplacement) * 3.0) * (uThinking + uSpeaking);
    
    // Special glow during energy flow
    if (uEnergyFlow > 0.0) {
      float flowGlow = sin(vPos.y * 10.0 + uTime * 4.0) * 0.5 + 0.5;
      colour += vec3(0.2, 0.6, 0.8) * flowGlow * uEnergyFlow * 0.4;
    }
    
    // Interior transparent, maintain transparency during states
    float baseAlpha = mix(0.1, 0.7, fresnel);
    // Smooth alpha values during state transitions
    float thinkingAlpha = smoothstep(0.0, 1.0, uThinking) * 0.3;
    float speakingAlpha = smoothstep(0.0, 1.0, uSpeaking) * 0.4;
    float stateAlpha = max(thinkingAlpha, speakingAlpha);
    float alpha = baseAlpha + stateAlpha;
    
    gl_FragColor = vec4(colour, alpha);
  }`
);

// Extend Three.js with the custom material
extend({ ThinFilmMaterial });

// TypeScript declarations for JSX
declare module '@react-three/fiber' {
  interface ThreeElements {
    thinFilmMaterial: ThreeElements['shaderMaterial'];
  }
}
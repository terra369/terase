import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Icosahedron, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useBallBotAnimation } from './hooks/useBallBotAnimation';
import { VISUAL_CONSTANTS } from './constants';
import type { ThinFilmShaderMaterial, TransformData } from './types';
import './shaders/ThinFilmMaterial';

// Helper function to calculate transform data
function calculateTransform(
  animationData: {
    thinking: number;
    speaking: number;
    energyFlow: number;
    amp: number;
    responsiveScale: number;
    phaseX: number;
    phaseY: number;
    phaseZ: number;
  },
  elapsedTime: number
): TransformData {
  const {
    thinking,
    speaking,
    energyFlow,
    amp,
    responsiveScale,
    phaseX,
    phaseY,
    phaseZ,
  } = animationData;
  
  // Calculate scale
  const baseScale = (1 + amp * VISUAL_CONSTANTS.AUDIO_SCALE_FACTOR) * responsiveScale;
  const thinkingScale = 1 + thinking * VISUAL_CONSTANTS.THINKING_SCALE_FACTOR * Math.sin(elapsedTime * 2);
  const speakingScale = 1 + speaking * VISUAL_CONSTANTS.SPEAKING_SCALE_FACTOR;
  const transitionScale = 1 + energyFlow * VISUAL_CONSTANTS.ENERGY_FLOW_AMPLITUDE * Math.sin(elapsedTime * VISUAL_CONSTANTS.ENERGY_FLOW_FREQUENCY);
  
  const scale = baseScale * thinkingScale * speakingScale * transitionScale;
  
  // Calculate position
  const floatY = Math.sin(elapsedTime * VISUAL_CONSTANTS.FLOAT_Y_SPEED + phaseY) * VISUAL_CONSTANTS.FLOAT_Y_AMPLITUDE;
  const floatX = Math.sin(elapsedTime * VISUAL_CONSTANTS.FLOAT_X_SPEED + phaseX) * VISUAL_CONSTANTS.FLOAT_X_AMPLITUDE;
  const floatZ = Math.sin(elapsedTime * VISUAL_CONSTANTS.FLOAT_Z_SPEED + phaseZ) * VISUAL_CONSTANTS.FLOAT_Z_AMPLITUDE;
  const thinkingVibration = thinking * VISUAL_CONSTANTS.THINKING_VIBRATION * Math.sin(elapsedTime * 15);
  
  // Calculate rotation
  const thinkingRotation = thinking * Math.sin(elapsedTime * VISUAL_CONSTANTS.ROTATION_THINKING_SPEED) * VISUAL_CONSTANTS.ROTATION_THINKING_AMPLITUDE;
  const speakingRotation = speaking * elapsedTime * VISUAL_CONSTANTS.ROTATION_SPEAKING_SCALE;
  
  return {
    scale,
    position: {
      x: floatX + thinkingVibration,
      y: floatY,
      z: floatZ,
    },
    rotation: {
      x: Math.sin(elapsedTime * 0.05) * VISUAL_CONSTANTS.ROTATION_X_AMPLITUDE + thinkingRotation,
      y: elapsedTime * VISUAL_CONSTANTS.ROTATION_BASE_SPEED + speakingRotation,
    },
  };
}

export function BallBot() {
  // Refs for Three.js objects
  const meshRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  
  // Use animation hook
  const { updateAnimation } = useBallBotAnimation();
  
  // Animation frame
  useFrame(({ clock }) => {
    const elapsedTime = clock.elapsedTime;
    
    // Update animation state
    const animationData = updateAnimation();
    
    // Update shader uniforms
    if (meshRef.current) {
      const material = meshRef.current.material as ThinFilmShaderMaterial;
      material.uniforms.uTime.value = elapsedTime;
      material.uniforms.uAmp.value = animationData.amp;
      material.uniforms.uThinking.value = animationData.thinking;
      material.uniforms.uSpeaking.value = animationData.speaking;
      material.uniforms.uStateTransition.value = animationData.transition;
      material.uniforms.uEnergyFlow.value = animationData.energyFlow;
      
      // Calculate and apply transforms
      const transform = calculateTransform(animationData, elapsedTime);
      meshRef.current.scale.setScalar(transform.scale);
    }
    
    // Update group transform
    if (groupRef.current) {
      const transform = calculateTransform(animationData, elapsedTime);
      
      groupRef.current.position.set(
        transform.position.x,
        transform.position.y,
        transform.position.z
      );
      
      groupRef.current.rotation.x = transform.rotation.x;
      groupRef.current.rotation.y = transform.rotation.y;
    }
  });
  
  return (
    <>
      {/* Environment for reflections only */}
      <Environment preset="city" background={false} backgroundBlurriness={0} />
      
      {/* Basic lighting */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <ambientLight intensity={0.5} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      
      {/* Floating group with gentle movement */}
      <Float
        speed={0.5}
        rotationIntensity={0.05}
        floatIntensity={0.2}
        floatingRange={[-0.03, 0.03]}
      >
        <group ref={groupRef}>
          {/* Holographic sphere */}
          <Icosahedron ref={meshRef} args={[1, 36]}>
            {/* eslint-disable react/no-unknown-property */}
            <thinFilmMaterial
              transparent={true}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
            {/* eslint-enable react/no-unknown-property */}
          </Icosahedron>
        </group>
      </Float>
    </>
  );
}
import React, { useRef } from 'react';
import { useFrame, extend, ThreeElements } from '@react-three/fiber';
import { Icosahedron, shaderMaterial, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useAudioStore } from '@/stores/useAudioStore';

/* ------------------------------------------------------------------
  ThinFilmMaterial – soap-bubble interference colours (audio reactive)
   – Inspired by Rouser "bubble" implementation
-------------------------------------------------------------------*/
const ThinFilmMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmp: 0,
  },
  /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vPos    = position;
    // gentle breathing + audio pulse displacement
    vec3 p = position + normal * (sin(uTime * 2.0 + position.y * 6.0) * 0.02 + uAmp * 0.05);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
  }`,
  /* glsl */ `
  precision highp float;
  const float PI = 3.14159265359;
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vNormal;
  varying vec3 vPos;
  // thin-film interference – approximate RGB wavelengths
  vec3 thinFilm(float nm, float cosI){
    vec3 phase = vec3(2.0*PI/700.0, 2.0*PI/546.0, 2.0*PI/435.0);
    float opd  = 2.0 * nm * cosI;
    return 0.5 + 0.5 * cos(phase * opd);
  }
  // HSL to RGB conversion
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }
  void main(){
    // film thickness varies with time & position
    float nm = 320.0 + 200.0 * sin(uTime + vPos.y*4.0 + vPos.x*2.0);
    float cosI = abs(dot(normalize(vNormal), vec3(0.0,0.0,1.0)));
    // Fresnel factor emphasises edges (rim)
    float fresnel = pow(1.0 - cosI, 3.0);
    // pastel rainbow colour only near rim
    float hue = fract(vPos.y * 0.4 + uTime * 0.04);
    vec3 rainbow = hsl2rgb(vec3(hue, 0.75, 0.55));
    float rim = mix(0.4, 1.0, fresnel);
    vec3 colour = rainbow * rim * (0.6 + uAmp * 0.5);
    // calculate alpha to keep interior very transparent
    float alpha = mix(0.05, 0.6, fresnel);
    gl_FragColor = vec4(colour, alpha);
  }`
);
extend({ ThinFilmMaterial });

// make JSX tag <thinFilmMaterial /> available
declare module '@react-three/fiber' {
  interface ThreeElements {
    thinFilmMaterial: ThreeElements['shaderMaterial'];
  }
}

/* ------------------------------------------------------------------
   BallBot – single soap-bubble that scales / pulses with audio amp
-------------------------------------------------------------------*/
export function BallBot() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const amp = useAudioStore((s) => s.amp);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (meshRef.current) {
      const unis = (meshRef.current.material as any).uniforms;
      unis.uTime.value = t;
      unis.uAmp.value = amp;
      // subtle overall scale pulse
      meshRef.current.scale.setScalar(1 + amp * 0.3);
    }
  });

  return (
    <>
      {/* environment for nice reflections */}
      <Environment preset="sunset" background={false} />
      <Icosahedron ref={meshRef} args={[1, 32]}>
        <thinFilmMaterial
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </Icosahedron>
    </>
  );
}

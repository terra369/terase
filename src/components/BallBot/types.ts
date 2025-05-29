import type { ShaderMaterial, IUniform } from 'three';

// Shader material uniforms type
export interface ThinFilmUniforms {
  uTime: IUniform<number>;
  uAmp: IUniform<number>;
  uThinking: IUniform<number>;
  uSpeaking: IUniform<number>;
  uStateTransition: IUniform<number>;
  uEnergyFlow: IUniform<number>;
  [uniform: string]: IUniform<unknown>;
}

// Extended shader material with typed uniforms
export interface ThinFilmShaderMaterial extends ShaderMaterial {
  uniforms: ThinFilmUniforms;
}

// Animation frame data
export interface AnimationFrameData {
  thinking: number;
  speaking: number;
  transition: number;
  energyFlow: number;
  amp: number;
  responsiveScale: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;
}

// Transform data for mesh and group
export interface TransformData {
  scale: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
  };
}
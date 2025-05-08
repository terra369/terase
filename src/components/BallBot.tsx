import { useRef } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Icosahedron, shaderMaterial, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useAudioStore } from '@/stores/useAudioStore';

/* ------------------------------------------------------------------
  ThinFilmMaterial – ホログラフィックシャボン玉表現
   – 虹色ベースの半透明マテリアル
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
  varying vec3 vViewPosition;
  
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    vViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    
    // ホログラフィック表現の揉れ
    float t = uTime * 0.7;
    float waveX = sin(t * 0.6 + position.y * 3.0) * 0.01;
    float waveY = sin(t * 0.5 + position.x * 2.0) * 0.015;
    float waveZ = sin(t * 0.4 + position.z * 2.5) * 0.01;
    
    // 音量による波動効果
    float audioEffect = uAmp * 0.04;
    
    // 変位を組み合わせる
    vec3 displacement = normal * (waveX + waveY + waveZ + audioEffect);
    vec3 newPosition = position + displacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }`,
  /* glsl */ `
  precision highp float;
  const float PI = 3.14159265359;
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vViewPosition;
  
  // HSL to RGB conversion
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }
  
  void main(){
    // 視点方向と法線のドット積でフレネル効果を計算
    vec3 viewDir = normalize(-vViewPosition);
    float cosI = abs(dot(normalize(vNormal), viewDir));
    
    // 端の強調のより強いフレネル
    float fresnel = pow(1.0 - cosI, 3.5);
    
    // 端の柔らかな虹色効果
    float hue = fract(vPos.y * 0.2 + vPos.x * 0.1 + uTime * 0.05);
    vec3 rainbow = hsl2rgb(vec3(hue, 0.7, 0.6));
    
    // 端に向かって強くなる虹色効果
    float rim = mix(0.1, 1.0, fresnel);
    vec3 colour = rainbow * rim * (0.6 + uAmp * 0.6);
    
    // 内部は非常に透明に
    float alpha = mix(0.02, 0.7, fresnel);
    
    gl_FragColor = vec4(colour, alpha);
  }`
);

// コンポーネントを拡張
 extend({ ThinFilmMaterial });

// JSXタグの型定義
 declare module '@react-three/fiber' {
  interface ThreeElements {
    thinFilmMaterial: ThreeElements['shaderMaterial'];
  }
}

/* ------------------------------------------------------------------
   BallBot – 音声に反応するJARVIS風ホログラフィック表現
-------------------------------------------------------------------*/
export function BallBot() {
  // シェーダーを適用する球体への参照
  const meshRef = useRef<THREE.Mesh>(null!);
  // 浮遊動作のあるグループへの参照
  const groupRef = useRef<THREE.Group>(null!);
  // 音声の振幅値を取得
  const amp = useAudioStore((s) => s.amp || 0);

  // 浮遊動作用の初期位相をランダム化
  const phaseX = useRef(Math.random() * Math.PI * 2);
  const phaseY = useRef(Math.random() * Math.PI * 2);
  const phaseZ = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    
    // シェーダーパラメータの更新
    if (meshRef.current) {
      // マテリアルのuniformsにアクセス
      const unis = (meshRef.current.material as THREE.ShaderMaterial).uniforms;
      unis.uTime.value = t;
      unis.uAmp.value = amp;
      
      // 音声に反応するスケール変化を微修正
      meshRef.current.scale.setScalar(1 + amp * 0.25);
    }
    
    // ホログラム全体の浮遊動作
    if (groupRef.current) {
      // 複数のサイン波の組み合わせで浮遊動作を作成
      const floatY = Math.sin(t * 0.4 + phaseY.current) * 0.1;
      const floatX = Math.sin(t * 0.3 + phaseX.current) * 0.05;
      const floatZ = Math.sin(t * 0.35 + phaseZ.current) * 0.08;
      
      // 移動を適用
      groupRef.current.position.set(floatX, floatY, floatZ);
      
      // 端正な回転動作
      groupRef.current.rotation.y = t * 0.05;
      groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.02;
    }
  });

  return (
    <>
      {/* 環境反射光を設定 - 柔らかい光源 */}
      <Environment preset="city" background={false} />
      
      {/* 浮遊動作を持つグループ */}
      <group ref={groupRef}>
        {/* ホログラフィック球体 - 粒子数を増やしてより滑らかに */}
        <Icosahedron ref={meshRef} args={[1, 36]}>
          <thinFilmMaterial
            transparent={true}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Icosahedron>
      </group>
    </>
  );
}

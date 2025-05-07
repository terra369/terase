import React, { useRef, useState, useEffect } from "react";
import { useFrame, extend, ThreeElement } from "@react-three/fiber";
import { shaderMaterial, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useAudioStore } from "@/stores/useAudioStore";

// 虹色ホログラフィックシェーダーマテリアル
const RainbowHolographicMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmp: 0
  },
  // Vertex shader
  `
    precision highp float;
    uniform float uTime, uAmp;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vFresnel;

    void main() {
      vUv = uv;
      vNormal = normal;
      vPosition = position;
      
      // 視点からの角度に基づくフレネル効果を計算
      vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
      vFresnel = pow(1.0 - max(0.0, dot(normalize(normalMatrix * normal), viewDir)), 3.0);
      
      // 微細な波紋効果
      vec3 p = position;
      float wave = sin(uTime * 2.0 + position.y * 8.0) * 0.02;
      float audioWave = sin(uTime * 3.0 + position.x * 6.0) * uAmp * 0.05;
      
      p += normal * (wave + audioWave);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  // Fragment shader
  `
    precision highp float;
    uniform float uTime;
    uniform float uAmp;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vFresnel;
    
    // HSLからRGBへの変換関数
    vec3 hsl2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
    }
    
    // 代替パターン効果
    float circlePattern(vec2 uv, float scale) {
      return smoothstep(0.4, 0.6, length(sin(uv * scale + uTime * 0.2)));
    }

    void main() {
      // 虹色パターンの生成 - 時間と位置に基づいて変化
      float hue = fract(uTime * 0.1 + vPosition.x * 0.2 + vPosition.y * 0.1);
      vec3 rainbowColor = hsl2rgb(vec3(hue, 0.7, 0.5));
      
      // 音声反応パルス効果
      float pulse = 0.6 + sin(uTime * 2.0) * 0.1 + uAmp * 0.3;
      
      // フレネル効果（エッジグロー）
      float edgeGlow = vFresnel * 1.2;
      
      // 光る中心部
      float innerGlow = smoothstep(0.5, 0.0, length(vUv - 0.5) * 2.0);
      
      // 微細な円形パターン（横線の代わり）
      float pattern = circlePattern(vUv, 20.0) * 0.15;
      
      // 虹色の色とパターンを組み合わせる
      vec3 color = mix(
        rainbowColor * pulse,
        vec3(0.8, 0.95, 1.0),
        pattern + edgeGlow * 0.4
      );
      
      // エッジグローを追加
      vec3 glowColor = hsl2rgb(vec3(fract(hue + 0.5), 0.8, 0.6));
      color += glowColor * edgeGlow * 0.8;
      
      // 光る中心部分を追加
      color += rainbowColor * innerGlow * pulse * 0.7;
      
      // 微やかなフリッカー効果
      float flicker = 0.95 + 0.05 * sin(uTime * 10.0 + vUv.x * 5.0);
      color *= flicker;
      
      // 透明度: エッジは透明、中心は不透明
      float alpha = 0.3 + 0.5 * (1.0 - edgeGlow) + innerGlow * 0.4;
      alpha = min(0.9, alpha);
      
      gl_FragColor = vec4(color, alpha);
    }
  `
);

// Extend the materials to use in JSX
extend({ RainbowHolographicMaterial });

// Add types to ThreeElements so the element is recognized
declare module "@react-three/fiber" {
  interface ThreeElements {
    rainbowHolographicMaterial: ThreeElement<typeof RainbowHolographicMaterial>;
  }
}

// 外側のリングと点の装飾は削除

export const BallBot = () => {
  // メインメッシュとグループの参照
  const meshRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);

  // 状態管理 - リスニング中およびAI発話中かどうか
  const [isListening, setIsListening] = useState(false);
  const amp = useAudioStore(state => state.amp);
  const isSpeaking = useAudioStore(state => state.isSpeaking);

  // 音声レベルが一定以上になったらリスニングモードに
  useEffect(() => {
    if (amp > 0.2) {
      setIsListening(true);
      // 2秒後にリスニングモードを終了
      const timeout = setTimeout(() => setIsListening(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [amp]);

  // グループ全体の浮遊アニメーション
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const time = clock.elapsedTime;

      // 基本の浮遊動き
      let baseY = Math.sin(time * 0.5) * 0.05;

      // AIが話しているときはよりあわただしい動き
      if (isSpeaking) {
        // 早い波を加える
        baseY += Math.sin(time * 8.0) * 0.01;
        // 少し上下に動かす
        groupRef.current.position.y = baseY;
        // 話しているときは少しエネルギッシュに回転
        groupRef.current.rotation.y = Math.PI / 6 + Math.sin(time * 2.0) * 0.1;
        // 少し左右に揺れるように
        groupRef.current.rotation.z = Math.sin(time * 3.0) * 0.03;
      } else {
        // 通常時はおだやかな動き
        groupRef.current.position.y = baseY;
        groupRef.current.rotation.y = Math.PI / 6 + Math.sin(time * 0.3) * 0.05;
        groupRef.current.rotation.z = 0;
      }
    }

    // シェーダーマテリアルの更新
    if (meshRef.current) {
      const material = meshRef.current.material as any;
      material.uniforms.uTime.value = clock.elapsedTime;

      // 音声入力中はamp値をそのまま使う
      // AIが話しているときは擺れるパルスを生成
      if (isSpeaking) {
        // パルスの強さを0.1〜0.4の間で変化させる
        const speakingPulse = 0.1 + Math.abs(Math.sin(clock.elapsedTime * 8.0)) * 0.3;
        material.uniforms.uAmp.value = speakingPulse;
      } else {
        material.uniforms.uAmp.value = amp;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* メインの球体 - リスニング時や発話時にサイズ変化 */}
      <mesh
        ref={meshRef}
        scale={
          isListening ? 1.1 + amp * 0.3 : // リスニング時
            isSpeaking ? 1 + Math.abs(Math.sin(Date.now() * 0.004)) * 0.15 : // 発話時は脱拍するようなサイズ変化
              1 // 通常時
        }
      >
        <sphereGeometry args={[1, 128, 128]} />
        <rainbowHolographicMaterial
          toneMapped={false}
          transparent={true}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 内側の光るコア */}
      <mesh scale={0.7}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          transparent
          opacity={0.15}
        >
          <color attach="color" args={['#ffffff']} />
        </meshBasicMaterial>
      </mesh>
    </group>
  );
};

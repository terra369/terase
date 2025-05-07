import React, { useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { OrbitControls, GradientTexture } from '@react-three/drei';
import { BallBot } from './BallBot';

// キャンバス設定初期化コンポーネント
const SceneSetup = () => {
  const { gl, scene, camera } = useThree();

  // レンダラー設定 - トーンマッピングとHDRに最適化
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.outputColorSpace = THREE.SRGBColorSpace;

    // Bloomレイヤー設定
    camera.layers.enable(1); // layer 1 = bloom対象

    // 背景色
    scene.background = new THREE.Color("#000000");

    return () => {
      gl.toneMapping = THREE.NoToneMapping;
      camera.layers.disable(1);
    };
  }, [gl, scene, camera]);

  // カメラの緩やかなドリー効果
  useFrame(({ camera }) => {
    camera.position.z = 3.5 + Math.sin(Date.now() * 0.0001) * 0.3;
  });

  return null;
};

// バックライト
const JarvisLighting = () => {
  return (
    <>
      {/* キーライト - 背面 */}
      <pointLight
        position={[0, -2, -3]}
        intensity={8}
        color="#00e5ff"
        distance={10}
        decay={2}
        castShadow={false}
      />

      {/* リムライト - カメラ背面 */}
      <directionalLight
        position={[-5, 5, 5]}
        intensity={1}
        color="#8a2be2"
        castShadow={false}
      />

      {/* 全体的な薄明るさ */}
      <ambientLight intensity={0.05} color="#0077aa" />
    </>
  );
};

// 背景グラデーション平面
const BackgroundGradient = () => {
  return (
    <mesh renderOrder={-1} position={[0, 0, -10]} rotation={[0, 0, 0]}>
      <planeGeometry args={[50, 50]} />
      <meshBasicMaterial
        depthWrite={false}
        side={THREE.DoubleSide}
      >
        <GradientTexture
          attach="map"
          stops={[0, 0.45, 0.55, 1]}
          colors={['#0a0a14', '#0a1a33', '#0a1a33', '#000000']}
        />
      </meshBasicMaterial>
    </mesh>
  )
};

interface JarvisHologramProps {
  width?: string;
  height?: string;
}

export const JarvisHologram: React.FC<JarvisHologramProps> = ({
  width = '100%',
  height = '100%'
}) => {
  return (
    <div style={{ width, height, position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true
        }}
      >
        {/* シーン設定 */}
        <SceneSetup />

        {/* 照明 */}
        <JarvisLighting />

        {/* 主役のホログラム球体 - レイヤー1に所属 */}
        <group layers={1}>
          <BallBot bloomLayer={1} />
        </group>

        {/* カメラコントロール - 緩やかな自動回転 */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={true}
          autoRotate={true}
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.5}
        />

        {/* エフェクトコンポーザー */}
        <EffectComposer>
          {/* 選択的ブルーム - レイヤー1の要素のみが対象 */}
          <Bloom
            mipmapBlur
            luminanceThreshold={0.6}
            luminanceSmoothing={0.4}
            intensity={1.2}
            radius={0.4}
          />
          {/* 色収差 */}
          <ChromaticAberration
            offset={[0.001, 0.001]}
            blendFunction={BlendFunction.NORMAL}
            radialModulation={true}
            modulationOffset={0.5}
          />
          {/* 周辺減光効果 */}
          <Vignette
            offset={0.3}
            darkness={0.8}
            eskil={false}
            blendFunction={BlendFunction.NORMAL}
          />
          {/* わずかなノイズ */}
          <Noise
            opacity={0.015}
            blendFunction={BlendFunction.OVERLAY}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default JarvisHologram;

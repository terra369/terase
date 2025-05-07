import React, { useRef, useState, useEffect } from "react";
import { useFrame, extend, ThreeElement } from "@react-three/fiber";
import { shaderMaterial, Icosahedron, Ring } from "@react-three/drei";
import * as THREE from "three";
import { useAudioStore } from "@/stores/useAudioStore";

// 高度な虹色ホログラフィックシェーダーマテリアル
// Jarvis風ホログラムエフェクトを強化
// メインホログラムシェーダー
const HolographicGlassMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmp: 0,
    uFresnelPower: 1.2,
    uIridescenceStrength: 1.0,
    uBaseColor: new THREE.Color(0x00e5ff),
    uTransmission: 1.0,
    uIor: 1.5,
    uRoughness: 0.05,
    uMetalness: 0.2
  },
  // Vertex shader
  `
  precision highp float;
    
    uniform float uTime;
    uniform float uAmp;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vViewDir;
    varying vec3 vWorldPosition;
    varying float vFresnel;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

      // ワールド空間での位置を計算
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // カメラから頂点への方向ベクトル
  vViewDir = normalize(cameraPosition - worldPosition.xyz);

  // フレネル効果の計算 (WindSurf 仕様: fresnelPower = 2.2)
  vFresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.2);

      // SFホログラム的な波動変形
      vec3 p = position;

      // 複数の波を重ね合わせて複雑な動きを作成
      float baseWave = sin(uTime * 2.0 + position.y * 6.0) * 0.02;
      float detailWave = sin(uTime * 3.0 + position.x * 8.0 + position.z * 4.0) * 0.01;

      // 音声に反応する波動 (WindSurf reactiveUniform: "uAmp")
      float audioWave = sin(uTime * 1.5 + position.y * 5.0) * uAmp * 0.12;

      // 渦巻き効果 (WindSurf: swirlDistortion)
      float swirl = sin(uTime * 0.8 + length(position) * 8.0) * uAmp * 0.08;

  // 変形を法線方向に適用
  p += normal * (baseWave + detailWave + audioWave + swirl);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
  `,

  // Fragment shader
  `
    precision highp float;
    
    uniform float uTime;
    uniform float uAmp;
    uniform float uFresnelPower;
    uniform float uIridescenceStrength;
    uniform vec3 uBaseColor;
    uniform float uTransmission;
    uniform float uIor;
    uniform float uRoughness;
    uniform float uMetalness;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vViewDir;
    varying vec3 vWorldPosition;
    varying float vFresnel;
    
    // HSLからRGBへの変換
    vec3 hsl2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
    }
    
    // 屈折効果をシミュレートする関数 (波長分散)
    vec3 disperseRefraction(vec3 viewDir, vec3 normal, float ior, float dispersionStrength) {
      // 波長ごとの屈折率の差を表現
      float redIor = ior * (1.0 - dispersionStrength * 0.02);
      float greenIor = ior;
      float blueIor = ior * (1.0 + dispersionStrength * 0.02);
      
      // 簡易的な屈折シミュレーション
      vec3 refracted;
      refracted.r = dot(viewDir, normal) * redIor;
      refracted.g = dot(viewDir, normal) * greenIor;
      refracted.b = dot(viewDir, normal) * blueIor;
      
      return refracted;
    }
    
    // 3Dノイズ関数
    float noise3D(vec3 p) {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
    }
    
    // トンマッピング
    vec3 toneMap(vec3 color) {
      // シンプルなReinhard風トーンマッピング
      return color / (color + vec3(1.0));
    }

    void main() {
      // 視点からのレイと法線の関係性を利用
      vec3 viewDir = vViewDir;
      vec3 normal = vNormal;
      
      // 波長分散による屈折効果（WindSurf: dispersion: true）
      vec3 refracted = disperseRefraction(viewDir, normal, uIor, 2.0);
      
      // 位置と時間に基づく虹色効果のベース色相
      float baseHue = fract(uTime * 0.1 + vPosition.x * 0.2 + vPosition.y * 0.1);
      
      // 虹色の干渉パターン（WindSurf: iridescenceStrength: 1.0）
      float iridescenceHue = fract(baseHue + vFresnel * 0.5);
      vec3 iridescence = hsl2rgb(vec3(iridescenceHue, 0.8, 0.6));
      
      // 音声反応パルス効果（内部の光の揺らぎ）
      float pulse = 0.6 + sin(uTime * 2.0) * 0.1 + uAmp * 0.6;
      
      // フレネル効果によるエッジグロー
      float edgeGlow = vFresnel;
      
      // 内部の光の効果
      float innerGlow = smoothstep(0.7, 0.0, length(vUv - 0.5) * 1.8);
      
      // ----- 変更ここから ----------------------------------------
      // 位置＆時間＆ノイズで生成した虹色を"常に"ベースとして使用
      vec3 rainbowA = hsl2rgb(vec3(baseHue, 0.8, 0.55));
      vec3 rainbowB = hsl2rgb(vec3(fract(baseHue + 0.33), 0.8, 0.55));
      float n = noise3D(vPosition * 4.5 + uTime * 0.2);
      vec3 rainbow = mix(rainbowA, rainbowB, n) * pulse;

      // 屈折色を虹色に置き換え、uBaseColor は "乗算" で残す
      vec3 refractedColor = rainbow * 1.2 * uBaseColor;

      // 最終色: 虹色 + (フレネルで強調された虹色のハイライト)
      vec3 color = refractedColor +
                   iridescence * pulse * 0.6 * vFresnel * uIridescenceStrength;
      // ----- 変更ここまで ----------------------------------------
      
      // エッジグローを追加
      color += iridescence * edgeGlow * 1.2;
      
      // 内部の光を追加
      color += iridescence * innerGlow * pulse * 0.8;
      
      // 微細なスパークル効果
      float sparkle = pow(noise3D(vPosition * 30.0 + uTime * 2.0), 20.0) * 2.0;
      color += vec3(sparkle) * uAmp;
      
      // 音声に反応するフリッカー効果
      float flicker = 0.92 + 0.08 * sin(uTime * 10.0 + noise3D(vPosition) * 10.0);
      color *= mix(1.0, flicker, uAmp * 0.5);
      
      // トーンマッピングで色の範囲を調整
      color = toneMap(color);
      
      // WindSurfのポストプロセス（bloom）に合わせた輝度調整
      color *= 1.5;
      
      // 透明度: フレネル効果と内部の光に基づく
      float alpha = mix(0.2, 0.8, vFresnel * 0.5 + innerGlow * 0.7);
      alpha = min(0.9, alpha);
      
      gl_FragColor = vec4(color, alpha);
    }
  `
);

// 外殻用グローシェーダー - 輪郭を強調するための小さなシェーダー
const JarvisHaloMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmp: 0
  },
  // Vertex shader
  `
  precision highp float;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    uniform float uAmp;

void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
      vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vViewDir = normalize(cameraPosition - worldPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
  `,
  // Fragment shader
  `
    precision highp float;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    uniform float uAmp;

void main() {
      // フレネル効果をリムグローとして使用
      float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 3.0);

      // 輪郭グロー効果
      float glow = fresnel * (0.5 + uAmp * 0.5);
      float alpha = glow * glow * glow; // キュービックカーブで周辺のみ光る

      // シアン系の色を使用
      vec3 glowColor = mix(
  vec3(0.0, 0.9, 1.0), // メインカラー（シアン）
  vec3(0.5, 0.8, 1.0), // サブカラー（薄い青）
  fresnel
);

      // 音声に応じた強度変化
      float pulse = 0.8 + sin(uTime * 3.0) * 0.1 + uAmp * 0.3;

  gl_FragColor = vec4(glowColor * pulse, alpha);
}
  `
);

// JSXで使用できるようにマテリアルを拡張
extend({ HolographicGlassMaterial, JarvisHaloMaterial });

// ThreeElementsに型定義を追加
declare module "@react-three/fiber" {
  interface ThreeElements {
    holographicGlassMaterial: ThreeElement<typeof HolographicGlassMaterial>;
    jarvisHaloMaterial: ThreeElement<typeof JarvisHaloMaterial>;
  }
}

export const BallBot = ({ bloomLayer = 1 }) => {
  // メッシュとグループのリファレンス
  const meshRef = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);

  // 状態管理
  const [isListening, setIsListening] = useState(false);

  // 音声状態を取得
  const amp = useAudioStore(state => state.amp);
  const isSpeaking = useAudioStore(state => state.isSpeaking);
  const intonation = useAudioStore(state => state.intonation);
  const features = useAudioStore(state => state.features);
  const speechProgress = useAudioStore(state => state.speechProgress);

  // 音声レベルが一定以上になったらリスニングモードに
  useEffect(() => {
    if (amp > 0.2) {
      setIsListening(true);
      const timeout = setTimeout(() => setIsListening(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [amp]);

  // アニメーション
  useFrame(({ clock }) => {
    if (groupRef.current && meshRef.current && coreRef.current) {
      const time = clock.elapsedTime;
      const material = meshRef.current.material as any;

      // 基本の浮遊動き - WindSurfのselfRotationに対応
      let baseY = Math.sin(time * 0.5) * 0.05;
      let rotationSpeed = 0.05; // 5 deg/sec (WindSurf定義)

      // ホログラフィックなマテリアルの更新
      if (material && material.uniforms) {
        material.uniforms.uTime.value = time;

        // リスニングモード時の動きと視覚効果
        if (isListening) {
          // 強い音声入力を得たときは活発に反応
          baseY += Math.sin(time * 6.0) * amp * 0.05;
          groupRef.current.position.y = baseY;
          groupRef.current.rotation.y += rotationSpeed * 3.0 * (1.0 + amp) * 0.016; // より速く回転
          groupRef.current.rotation.z = Math.sin(time * 3.0) * 0.02 * amp;

          // マテリアルの音声反応パラメータを設定
          material.uniforms.uAmp.value = amp * 1.5;
          material.uniforms.uIridescenceStrength.value = 1.2 + amp * 0.3;

          // 内部のコアも強く反応
          if (coreRef.current.material) {
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + amp * 0.3;
          }
        }
        // 発話中の動きと視覚効果
        else if (isSpeaking) {
          // 単語の進行状況を取得
          const wordEmphasis = speechProgress.wordEmphasis || 0;
          const currentWordIndex = speechProgress.currentWordIndex || 0;
          const progress = speechProgress.progress || 0;

          // 抑揚タイプと単語の強調度に基づく動きのパラメータ
          let ySpeed = 0;
          let rotYIntensity = 0;
          let rotZIntensity = 0;
          let energyFactor = features.energyChange * 0.5 + wordEmphasis * 0.3;

          // 抑揚タイプに応じた動きの変化
          switch (intonation) {
            case 'question':
              // 質問は上昇する動き
              ySpeed = 2.0 + features.voicePitch * 3.0 + wordEmphasis * 2.0;
              rotYIntensity = 0.15 + wordEmphasis * 0.1;
              rotZIntensity = 0.04 + wordEmphasis * 0.03;
              baseY += 0.02 * features.voicePitch + 0.03 * progress;
              break;

            case 'emphasis':
              // 強調はよりダイナミックな動き
              ySpeed = 3.0 + wordEmphasis * 3.0;
              rotYIntensity = 0.2 + wordEmphasis * 0.15;
              rotZIntensity = 0.06 + wordEmphasis * 0.04;
              energyFactor *= 1.3;
              break;

            default: // 'normal'
              // 通常の発話
              ySpeed = 1.5 + features.energyChange * 2.0 + wordEmphasis * 1.0;
              rotYIntensity = 0.1 + wordEmphasis * 0.05;
              rotZIntensity = 0.03 + wordEmphasis * 0.02;
              break;
          }

          // 動きを適用
          baseY += Math.sin(time * ySpeed) * 0.01 * (1 + energyFactor);
          baseY += Math.sin(time * (1.0 + features.lowFreq * 3.0)) * 0.005 * features.lowFreq;
          baseY += Math.sin(time * (2.0 + features.midFreq * 5.0)) * 0.008 * features.midFreq;
          baseY += Math.sin(time * (3.0 + features.highFreq * 8.0)) * 0.012 * features.highFreq;

          // 位置と回転を更新
          groupRef.current.position.y = baseY;
          groupRef.current.rotation.y += rotationSpeed * (1.0 + wordEmphasis * 0.5) * 0.016;
          groupRef.current.rotation.y += Math.sin(time * (2.0 + energyFactor * 3.0)) * rotYIntensity * 0.01;
          groupRef.current.rotation.z = Math.sin(time * (3.0 + energyFactor * 2.0)) * rotZIntensity;

          // シェーダーパラメータの更新（単語の強調度と音声特性を反映）
          let audioReactiveAmp = features.amp + wordEmphasis * 0.3;

          // 単語のリズムに合わせた追加パルス
          const wordPulse = Math.sin(time * 4.0 + currentWordIndex * 0.5) * wordEmphasis * 0.5;
          audioReactiveAmp += Math.abs(wordPulse);

          // 虹色の干渉強度も単語に合わせて変動
          material.uniforms.uAmp.value = audioReactiveAmp;
          material.uniforms.uIridescenceStrength.value = 1.0 + wordEmphasis * 0.5;

          // 内部コアの明るさも単語に合わせて変動
          if (coreRef.current.material) {
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity =
              0.15 + features.amp * 0.2 + wordEmphasis * 0.1 + Math.abs(wordPulse) * 0.1;
          }
        }
        // 通常状態の動きと視覚効果
        else {
          // ゆっくりとした自然な浮遊と回転
          groupRef.current.position.y = baseY;
          groupRef.current.rotation.y += rotationSpeed * 0.016; // 5 deg/sec
          groupRef.current.rotation.z = 0;

          // 基本的なパラメータ
          material.uniforms.uAmp.value = amp;
          material.uniforms.uIridescenceStrength.value = 1.0;

          // 内部コアのデフォルト明るさ
          if (coreRef.current.material) {
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15;
          }
        }
      }
    }
  });

  // Bloomレイヤー用のユーティリティ関数
  const setBloomLayer = (obj: THREE.Object3D | null) => {
    if (obj && bloomLayer !== undefined) {
      obj.layers.enable(bloomLayer); // Bloom対象レイヤーを有効化
    }
    return obj;
  };

  return (
    <group ref={groupRef}>
      {/* WindSurf定義に合わせた高ポリゴンのicosahedron */}
      <Icosahedron
        ref={(obj) => {
          if (obj) {
            meshRef.current = obj;
            obj.layers.enable(bloomLayer);
          }
        }}
        args={[1, 12]} // 高解像度にアップ
        scale={
          isListening ? 1.1 + amp * 0.3 :
            isSpeaking ? (
              intonation === 'question' ?
                1 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.15 + features.voicePitch * 0.1 + speechProgress.wordEmphasis * 0.1 :
                intonation === 'emphasis' ?
                  1 + Math.abs(Math.sin(Date.now() * 0.008)) * 0.2 + features.energyChange * 0.15 + speechProgress.wordEmphasis * 0.15 :
                  1 + Math.abs(Math.sin(Date.now() * 0.004 * (1 + features.energyChange))) * 0.15 + speechProgress.wordEmphasis * 0.05
            ) :
              1
        }
      >
        <holographicGlassMaterial
          transparent={true}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </Icosahedron>

      {/* 外殻用の輪郭グローレイヤー - Jarvis風のリムエフェクト */}
      <Icosahedron
        ref={(obj) => {
          if (obj) obj.layers.enable(bloomLayer);
        }}
        args={[1.02, 8]} // 引数: 半径（メイン球体より少し大きい）、詳細度
        scale={
          isListening ? 1.1 + amp * 0.35 :
            isSpeaking ? (
              1 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.16 + features.energyChange * 0.15
            ) :
              1.01
        }
      >
        <jarvisHaloMaterial
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </Icosahedron>

      {/* 内部の光るコア - より大きく明るく */}
      <Icosahedron
        ref={(obj) => {
          if (obj) {
            coreRef.current = obj;
            obj.layers.enable(bloomLayer);
          }
        }}
        args={[0.5, 4]} // 半径を小さくソリッドコアに
        scale={isListening ? 0.9 + amp * 0.4 : 0.85}
      >
        <meshBasicMaterial
          color="#4be8ff" // 明るいシアン色
          transparent
          opacity={0.05 + (isSpeaking ? features.amp * 0.1 : 0)} // 非常に薄く、Bloomで強調される
        />
      </Icosahedron>

      {/* 赤道上の薄い光のリング */}
      <Ring
        ref={(obj) => {
          if (obj) obj.layers.enable(bloomLayer);
        }}
        args={[1.3, 1.35, 64]} // 内径、外径、セグメント数
        rotation={[Math.PI / 2, 0, 0]} // X軸の回りに90度回転して水平に
        position={[0, 0, 0]}
      >
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.06 + (isListening ? amp * 0.1 : 0)}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </Ring>
    </group>
  );
};

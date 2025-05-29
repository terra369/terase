import { useRef } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Icosahedron, shaderMaterial, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useAudioStore } from '@/stores/useAudioStore';
import { useConversationStore } from '@/stores/useConversationStore';

/* ------------------------------------------------------------------
  ThinFilmMaterial – ホログラフィックシャボン玉表現
   – 虹色ベースの半透明マテリアル
-------------------------------------------------------------------*/
const ThinFilmMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmp: 0,
    uThinking: 0,
    uSpeaking: 0,
    uStateTransition: 0,
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
    
    // ホログラフィック表現の揉れ（より穏やかに）
    float t = uTime * 0.3;
    float waveX = sin(t * 0.4 + position.y * 2.0) * 0.005;
    float waveY = sin(t * 0.3 + position.x * 1.5) * 0.007;
    float waveZ = sin(t * 0.25 + position.z * 1.8) * 0.005;
    
    // 音量による波動効果（控えめに）
    float audioEffect = uAmp * 0.02;
    
    // 思考中の神経パルス効果（より穏やかに）
    float thinkingPulse = 0.0;
    if (uThinking > 0.0) {
      float pulseFreq = 3.0 + sin(uTime * 0.8) * 1.0;
      thinkingPulse = sin(uTime * pulseFreq + position.y * 5.0) * 0.015;
      thinkingPulse += sin(uTime * pulseFreq * 1.1 + position.x * 4.0) * 0.01;
      thinkingPulse *= uThinking;
    }
    
    // 話し中の波紋効果（より穏やかに）
    float speakingWave = 0.0;
    if (uSpeaking > 0.0) {
      float waveTime = uTime * 1.5;
      speakingWave = sin(length(position.xy) * 8.0 - waveTime) * 0.02;
      speakingWave += sin(length(position.xz) * 6.0 - waveTime * 0.5) * 0.015;
      speakingWave *= uSpeaking * (1.0 + uAmp * 0.5);
    }
    
    // 変位を組み合わせる
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
    // 視点方向と法線のドット積でフレネル効果を計算
    vec3 viewDir = normalize(-vViewPosition);
    float cosI = abs(dot(normalize(vNormal), viewDir));
    
    // 端の強調のより強いフレネル
    float fresnel = pow(1.0 - cosI, 3.5);
    
    // 基本の虹色効果（ゆっくりとした変化）
    float baseHue = fract(vPos.y * 0.2 + vPos.x * 0.1 + uTime * 0.02);
    
    // 思考中：明るいサイバーブルー (シアン)
    vec3 thinkingColor = hsl2rgb(vec3(0.5, 0.9, 0.75));
    
    // 話し中：明るいゴールド～オレンジ
    float speakingHue = fract(uTime * 0.1 + length(vPos.xy) * 0.2);
    vec3 speakingColor = hsl2rgb(vec3(0.08 + speakingHue * 0.1, 0.85, 0.7));
    
    // 通常の虹色（明るめ）
    vec3 rainbow = hsl2rgb(vec3(baseHue, 0.8, 0.7));
    
    // 状態に応じた色のブレンド
    vec3 stateColor = rainbow;
    stateColor = mix(stateColor, thinkingColor, uThinking);
    stateColor = mix(stateColor, speakingColor, uSpeaking);
    
    // エネルギーの脈動効果（控えめに）
    float energyPulse = 1.0;
    if (uThinking > 0.0) {
      energyPulse += sin(uTime * 4.0) * 0.15 * uThinking;
    }
    if (uSpeaking > 0.0) {
      energyPulse += (0.3 + uAmp * 0.5) * uSpeaking;
    }
    
    // 端に向かって強くなる効果（より明るく）
    float rim = mix(0.3, 1.2, fresnel);
    // 思考中・話し中は中心も明るくする
    if (uThinking > 0.0) {
      rim = mix(rim, 1.0, uThinking * 0.7);
    }
    if (uSpeaking > 0.0) {
      rim = mix(rim, 1.0, uSpeaking * 0.7);
    }
    vec3 colour = stateColor * rim * energyPulse * (0.8 + uAmp * 0.8);
    
    // 変位による追加の輝き（より明るく）
    colour += vec3(abs(vDisplacement) * 3.0) * (uThinking + uSpeaking);
    
    // 内部は透明に、状態時も透明感を保つ
    float baseAlpha = mix(0.1, 0.7, fresnel);
    float stateAlpha = max(uThinking * 0.3, uSpeaking * 0.4);
    float alpha = baseAlpha + stateAlpha;
    
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
  // 会話状態を取得
  const state = useConversationStore((s) => s.state);
  // メッセージリストを取得
  const messages = useConversationStore((s) => s.messages);
  
  // 状態のスムーズな遷移用
  const stateValues = useRef({
    thinking: 0,
    speaking: 0,
    transition: 0,
    speakingAfterEffect: 0, // speaking状態終了後の余韻
  });

  // 浮遊動作用の初期位相をランダム化
  const phaseX = useRef(Math.random() * Math.PI * 2);
  const phaseY = useRef(Math.random() * Math.PI * 2);
  const phaseZ = useRef(Math.random() * Math.PI * 2);
  
  // 最後のAIメッセージの長さを取得
  const lastAIMessage = messages.filter(m => m.speaker === 'ai').pop();
  
  // 現在の有効なspeaking値を保持（JSXで使用するため）
  const effectiveSpeakingRef = useRef(0);
  const speakingStartFrame = useRef(-1);
  const lastAIMessageId = useRef<string | null>(null);
  const currentSpeakingDuration = useRef(5); // デフォルト5秒

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    
    // 状態値のスムーズな遷移
    const targetThinking = (state === 'thinking' || state === 'transcribing') ? 1 : 0;
    const targetSpeaking = state === 'speaking' ? 1 : 0;
    
    stateValues.current.thinking += (targetThinking - stateValues.current.thinking) * 0.1;
    
    // speaking状態の遷移を速くして、すぐに効果が現れるようにする
    if (targetSpeaking > 0) {
      stateValues.current.speaking += (targetSpeaking - stateValues.current.speaking) * 0.3; // より速い遷移
    } else {
      stateValues.current.speaking += (targetSpeaking - stateValues.current.speaking) * 0.05; // ゆっくり戻る
    }
    
    // speaking状態に入った時に新しいAIメッセージがあればフレームカウンターをリセット
    if (targetSpeaking > 0 && lastAIMessage && lastAIMessage.id !== lastAIMessageId.current) {
      const messageLength = lastAIMessage.content?.length || 0;
      // テキストの長さから推定発話時間を計算（日本語の場合、1文字あたり約0.6秒）
      currentSpeakingDuration.current = Math.max(7, messageLength * 0.6); // 最小7秒
      
      console.log('New AI message detected in speaking state:', {
        messageId: lastAIMessage.id,
        length: messageLength,
        estimatedDuration: currentSpeakingDuration.current
      });
      
      lastAIMessageId.current = lastAIMessage.id;
      speakingStartFrame.current = 0;
      stateValues.current.speakingAfterEffect = 1;
    }
    
    // speaking状態終了後も継続（実際の音声再生は状態終了後に始まるため）
    if (targetSpeaking > 0 || stateValues.current.speaking > 0.5) {
      stateValues.current.speakingAfterEffect = 1;
      if (speakingStartFrame.current >= 0) {
        speakingStartFrame.current++;
      }
    } else if (stateValues.current.speakingAfterEffect > 0 && speakingStartFrame.current >= 0) {
      speakingStartFrame.current++;
      
      // テキストの長さに基づいた持続時間で管理
      const elapsedFrames = speakingStartFrame.current;
      const speakingFrameDuration = currentSpeakingDuration.current * 60; // 60FPSと仮定
      const progress = elapsedFrames / speakingFrameDuration;
      
      if (progress < 1.0) {
        // 発話中は高い値を維持
        if (progress < 0.9) {
          stateValues.current.speakingAfterEffect = 1.0;
        } else {
          // 最後の10%でフェードアウト
          stateValues.current.speakingAfterEffect = 1.0 - ((progress - 0.9) / 0.1);
        }
        
        // 進行状況をログ出力（1秒ごと）
        if (elapsedFrames % 60 === 0) {
          console.log('Speaking progress:', {
            elapsedSeconds: elapsedFrames / 60,
            totalSeconds: currentSpeakingDuration.current,
            progress: (progress * 100).toFixed(1) + '%'
          });
        }
      } else {
        // 発話終了
        console.log('Speaking animation completed');
        stateValues.current.speakingAfterEffect = 0;
        speakingStartFrame.current = -1;
      }
    }
    
    // 実際のspeaking効果は状態終了後の余韻を主に使用（実際の音声再生タイミングに合わせる）
    const effectiveSpeaking = Math.max(stateValues.current.speaking, stateValues.current.speakingAfterEffect);
    effectiveSpeakingRef.current = effectiveSpeaking; // JSXで使用するために保存
    
    stateValues.current.transition = Math.max(stateValues.current.thinking, effectiveSpeaking);

    // シェーダーパラメータの更新
    if (meshRef.current) {
      // マテリアルのuniformsにアクセス
      const unis = (meshRef.current.material as THREE.ShaderMaterial).uniforms;
      unis.uTime.value = t;
      unis.uAmp.value = amp;
      unis.uThinking.value = stateValues.current.thinking;
      unis.uSpeaking.value = effectiveSpeaking; // 余韻効果を含む値を使用
      unis.uStateTransition.value = stateValues.current.transition;

      // 状態に応じたスケール変化（控えめに）
      const baseScale = 1 + amp * 0.1;
      const thinkingScale = 1 + stateValues.current.thinking * 0.05 * Math.sin(t * 2);
      const speakingScale = 1 + effectiveSpeaking * 0.1; // 余韻効果を含む
      meshRef.current.scale.setScalar(baseScale * thinkingScale * speakingScale);
    }

    // ホログラム全体の浮遊動作
    if (groupRef.current) {
      // 複数のサイン波の組み合わせで浮遊動作を作成（穏やかに）
      const floatY = Math.sin(t * 0.2 + phaseY.current) * 0.05;
      const floatX = Math.sin(t * 0.15 + phaseX.current) * 0.025;
      const floatZ = Math.sin(t * 0.175 + phaseZ.current) * 0.04;
      
      // 思考中の微細な振動
      const thinkingVibration = stateValues.current.thinking * 0.01 * Math.sin(t * 15);

      // 移動を適用
      groupRef.current.position.set(
        floatX + thinkingVibration,
        floatY,
        floatZ
      );

      // 端正な回転動作 + 状態による追加回転（ゆっくり）
      const thinkingRotation = stateValues.current.thinking * Math.sin(t * 1.5) * 0.05;
      const speakingRotation = effectiveSpeaking * t * 0.1; // 余韻効果を含む
      
      groupRef.current.rotation.y = t * 0.02 + speakingRotation;
      groupRef.current.rotation.x = Math.sin(t * 0.05) * 0.01 + thinkingRotation;
    }
    
  });

  return (
    <>
      {/* 環境反射光を設定 - 背景なし、反射のみ */}
      <Environment preset="city" background={false} backgroundBlurriness={0} />
      
      {/* 基本的な照明を追加して明るくする */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <ambientLight intensity={0.5} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <pointLight position={[10, 10, 10]} intensity={0.5} />

      {/* 浮遊動作を持つグループ（穏やかに） */}
      <Float
        speed={0.5}
        rotationIntensity={0.05}
        floatIntensity={0.2}
        floatingRange={[-0.03, 0.03]}
      >
        <group ref={groupRef}>
          {/* ホログラフィック球体 - 粒子数を増やしてより滑らかに */}
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
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
uniform float uAudioPulse;
varying vec3 vPosition;

void main() {
  vPosition = position;

  // High-impact surface turbulence when speaking or listening to audio
  float wave = sin(position.y * 14.0 + uTime * 12.0) * cos(position.x * 14.0 + uTime * 10.0);
  float basePulse = 1.0 + uAudioPulse * (0.22 * wave);

  vec3 newPos = position * basePulse;

  vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);

  // Dynamically enlarge particles during voice output or mic input
  gl_PointSize = (2.5 + uAudioPulse * 3.5) * (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uColorOffset;
uniform float uSpeedMultiplier;

vec3 colorPalette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.50, 0.80, 0.95);

  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;

  // Faster color cycling during speech/audio activity
  float colorCycle = uTime * (0.06 * uSpeedMultiplier) + uColorOffset;
  vec3 dynamicColor = colorPalette(colorCycle);

  gl_FragColor = vec4(dynamicColor, 0.95);
}
`;

interface ParticleSphereProps {
  isSpeaking?: boolean;
  audioLevel?: number; // Real-time microphone input volume (0.0 to 1.0)
}

export default function ParticleSphere({ isSpeaking = false, audioLevel = 0 }: ParticleSphereProps) {
  const innerPointsRef = useRef<THREE.Points>(null!);
  const outerPointsRef = useRef<THREE.Points>(null!);
  const groupRef = useRef<THREE.Group>(null!);

  const innerUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioPulse: { value: 0 },
      uColorOffset: { value: 0.0 },
      uSpeedMultiplier: { value: 1.0 },
    }),
    []
  );

  const outerUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioPulse: { value: 0 },
      uColorOffset: { value: 0.35 },
      uSpeedMultiplier: { value: 1.0 },
    }),
    []
  );

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Determine target pulse based on JARVIS speaking state OR live mic audio input
    const isAudioActive = isSpeaking || audioLevel > 0.05;
    const targetPulse = isSpeaking
      ? 1.0 + Math.abs(Math.sin(time * 16.0)) * 0.8
      : audioLevel > 0.05
      ? audioLevel * 3.5
      : 0.1;

    // Physical mesh scale target
    const targetScale = isSpeaking
      ? 1.0 + Math.sin(time * 14.0) * 0.12 + Math.cos(time * 8.0) * 0.08
      : 1.0 + audioLevel * 0.35;

    // Smoothly interpolate overall group scale for physical pulse
    if (groupRef.current) {
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
    }

    if (innerPointsRef.current) {
      const mat = innerPointsRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = time;
      mat.uniforms.uSpeedMultiplier.value = isAudioActive ? 3.0 : 1.0;
      mat.uniforms.uAudioPulse.value = THREE.MathUtils.lerp(
        mat.uniforms.uAudioPulse.value,
        targetPulse,
        0.15
      );

      // Spin acceleration when talking or receiving mic input
      const rotSpeed = isAudioActive ? 1.8 : 0.2;
      innerPointsRef.current.rotation.y += 0.01 * rotSpeed;
      innerPointsRef.current.rotation.z += 0.005 * rotSpeed;
    }

    if (outerPointsRef.current) {
      const mat = outerPointsRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = time;
      mat.uniforms.uSpeedMultiplier.value = isAudioActive ? 3.0 : 1.0;
      mat.uniforms.uAudioPulse.value = THREE.MathUtils.lerp(
        mat.uniforms.uAudioPulse.value,
        targetPulse,
        0.15
      );

      const rotSpeed = isAudioActive ? 1.4 : 0.15;
      outerPointsRef.current.rotation.y -= 0.008 * rotSpeed;
      outerPointsRef.current.rotation.x += 0.004 * rotSpeed;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.4, 0]}>
      {/* 1. Inner Core Particle Sphere */}
      <points ref={innerPointsRef}>
        <sphereGeometry args={[1.0, 90, 90]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={innerUniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* 2. Outer Shell Particle Sphere */}
      <points ref={outerPointsRef}>
        <sphereGeometry args={[1.35, 100, 100]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={outerUniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Reactive ambient core light */}
      <pointLight color="#00f3ff" intensity={isSpeaking || audioLevel > 0.05 ? 12 : 4} distance={6} />
    </group>
  );
}
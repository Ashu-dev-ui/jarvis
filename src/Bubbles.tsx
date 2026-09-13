import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function Bubbles() {
  const count = 120;
  const meshRef = useRef<THREE.Points>(null!);

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;     // X spread
      pos[i * 3 + 1] = -6 + Math.random() * 12;    // Y spread
      pos[i * 3 + 2] = -3 + (Math.random() - 0.5) * 6; // Z depth
      spd[i] = 0.008 + Math.random() * 0.022;      // Rise speed
    }
    return [pos, spd];
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const geometry = meshRef.current.geometry;
    const positionAttr = geometry.attributes.position;
    const array = positionAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += speeds[i]; // Rise upward
      array[i * 3] += Math.sin(Date.now() * 0.0015 + i) * 0.003; // Gentle organic wobble

      // Reset bubble to the bottom when it floats past the top
      if (array[i * 3 + 1] > 6) {
        array[i * 3 + 1] = -6;
        array[i * 3] = (Math.random() - 0.5) * 12;
      }
    }
    positionAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        color="#00f3ff"
        transparent={true}
        opacity={0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
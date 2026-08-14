'use client';

import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron, Float } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/src/lib/useReducedMotion';

function Shard() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.08;
    meshRef.current.rotation.y += delta * 0.12;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.8}>
      <Icosahedron ref={meshRef} args={[1.6, 0]}>
        <meshPhysicalMaterial
          color="#5B7CFA"
          roughness={0.15}
          metalness={0.1}
          transmission={0.85}
          thickness={1.2}
          ior={1.4}
          emissive="#3355FF"
          emissiveIntensity={0.15}
        />
      </Icosahedron>
    </Float>
  );
}

function Particles() {
  const points = useMemo(() => {
    const arr = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4 - 2;
    }
    return arr;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#9AA3B8" transparent opacity={0.5} />
    </points>
  );
}

/** Detects whether the browser can actually create a WebGL context. */
function useWebglSupported() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setSupported(!!gl);
    } catch {
      setSupported(false);
    }
  }, []);
  return supported;
}

/**
 * Abstract low-poly glass shard + particle field, used in exactly two
 * places per the redesign scope: the homepage hero and the /display idle
 * state. Falls back to a static gradient blob if WebGL context creation
 * fails or the user prefers reduced motion — never a dependency of any
 * functional/input screen's critical render path.
 */
export default function HeroShard({ className = '' }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const webglSupported = useWebglSupported();

  if (reduced || webglSupported === false) {
    return (
      <div
        className={`rounded-full bg-gradient-to-br from-brand-500/30 via-orb-2/20 to-transparent blur-2xl ${className}`}
        aria-hidden="true"
      />
    );
  }

  // Don't render Canvas until we know WebGL is actually available (or SSR).
  if (webglSupported === null) {
    return <div className={className} aria-hidden="true" />;
  }

  return (
    <div className={className} aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 3]} intensity={1.2} color="#F7F8FC" />
        <pointLight position={[-3, -2, -2]} intensity={0.6} color="#7C3AED" />
        <Suspense fallback={null}>
          <Shard />
          <Particles />
        </Suspense>
      </Canvas>
    </div>
  );
}

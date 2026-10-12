import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Core() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const dt = Math.min(delta, 0.05);
    ref.current.rotation.y += dt * 0.25;
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, state.pointer.y * 0.4, 3, dt);
    ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, state.pointer.x * 0.4, 3, dt);
  });
  return (
    <Float speed={1.4} floatIntensity={1.2}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1.4, 6]} />
        <MeshDistortMaterial color="#b9c3ff" metalness={0.9} roughness={0.15} distort={0.35} speed={1.6} />
      </mesh>
    </Float>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const a = new Float32Array(900 * 3);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() - 0.5) * 14;
    return a;
  }, []);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += Math.min(delta, 0.05) * 0.03;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#dfe4ff" transparent opacity={0.7} />
    </points>
  );
}

export default function DownloadScene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <Environment>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={1} color="#8b9cff" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <Core />
      <Particles />
    </Canvas>
  );
}

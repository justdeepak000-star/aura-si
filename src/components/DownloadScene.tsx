import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment, Lightformer, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Core() {
  const ref = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    if (ref.current) {
      ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, state.pointer.y * 0.5, 3, dt);
      ref.current.rotation.z = THREE.MathUtils.damp(ref.current.rotation.z, -state.pointer.x * 0.3, 3, dt);
      ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, state.pointer.x * 0.5, 3, dt);
    }
    if (inner.current) {
      inner.current.rotation.y += dt * 0.3;
      const s = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.04;
      inner.current.scale.setScalar(s);
    }
  });
  return (
    <Float speed={1.4} floatIntensity={1.2}>
      <group ref={ref}>
        <mesh ref={inner}>
          <icosahedronGeometry args={[1.2, 6]} />
          <MeshDistortMaterial color="#b9c3ff" metalness={0.9} roughness={0.12} distort={0.4} speed={2} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[1.65, 1]} />
          <meshBasicMaterial color="#8b9cff" wireframe transparent opacity={0.25} />
        </mesh>
        <Ring r={2.1} speed={0.6} tilt={[1.2, 0, 0.3]} color="#9fb0ff" />
        <Ring r={2.5} speed={-0.4} tilt={[0.4, 0.9, 0]} color="#c9a7ff" />
        <Ring r={2.9} speed={0.25} tilt={[1.8, 0.4, 1]} color="#7fe3ff" />
      </group>
    </Float>
  );
}

function Ring({ r, speed, tilt, color }: { r: number; speed: number; tilt: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += Math.min(d, 0.05) * speed; });
  return (
    <group rotation={tilt}>
      <group ref={ref}>
        <mesh>
          <torusGeometry args={[r, 0.012, 8, 160]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} />
        </mesh>
        <mesh position={[r, 0, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[-r, 0, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    </group>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 2200, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const rad = 3 + Math.random() * 8, th = Math.random() * Math.PI * 2;
      a[i * 3] = Math.cos(th) * rad;
      a[i * 3 + 1] = (Math.random() - 0.5) * 6;
      a[i * 3 + 2] = Math.sin(th) * rad - 3;
    }
    return a;
  }, []);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const dt = Math.min(delta, 0.05);
    ref.current.rotation.y += dt * (0.05 + Math.abs(state.pointer.x) * 0.15);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, state.pointer.y * 0.15, 2, dt);
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#dfe4ff" transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

function Rig() {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, state.pointer.x * 0.8, 2, dt);
    state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, state.pointer.y * 0.5, 2, dt);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function DownloadScene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 7], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <pointLight position={[-3, -2, 2]} intensity={8} color="#7fe3ff" />
      <Environment>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={1} color="#8b9cff" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        <Lightformer intensity={1} color="#c9a7ff" position={[5, -1, -1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <Rig />
      <Core />
      <Particles />
      <Sparkles count={60} scale={[8, 5, 4]} size={3} speed={0.4} color="#b9c3ff" />
    </Canvas>
  );
}

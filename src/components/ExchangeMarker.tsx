// src/components/ExchangeMarker.tsx
"use client";
import React, { useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import * as THREE from "three";
import type { ExchangeMeta } from "../lib/store";

type Props = {
  exchange: ExchangeMeta;
  position: [number, number, number];
  color?: string;
  visible?: boolean;
  onClick?: (id: string) => void;
};

export default function ExchangeMarker({ exchange, position, color = "#FFD54F", visible = true, onClick }: Props) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [hovered, setHovered] = useState(false);

  // change cursor when hovering
  useCursor(hovered, "pointer", "auto");

  if (!visible) return null;

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
  };
  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHovered(false);
  };
  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (onClick) onClick(exchange.id);
  };

  // symbol size: bigger for emphasis
  const baseScale = hovered ? 1.25 : 1.0;
  const scale = 0.065 * baseScale; // tuned for globe radius 1.8

  return (
    <group position={position}>
      {/* marker sphere */}
      <mesh
        ref={meshRef}
        scale={[scale, scale, scale]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1.6 : 0.9}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>

      {/* small glow ring under the marker */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[scale * 1.25, scale * 2.25, 32]} />
        <meshBasicMaterial
          transparent
          opacity={hovered ? 0.55 : 0.28}
          color={color}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}


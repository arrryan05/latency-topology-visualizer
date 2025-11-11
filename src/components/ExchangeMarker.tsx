// // "use client";
// // import React, { useState, useRef } from "react";
// // import { Mesh } from "three";
// // import { Html } from "@react-three/drei";
// // import { useFrame } from "@react-three/fiber";
// // import type { ExchangeMeta } from "../lib/store";

// // type Props = {
// //   exchange: ExchangeMeta;
// //   position: [number, number, number];
// //   color?: string;
// //   onClick?: (ex: ExchangeMeta) => void;
// // };

// // export default function ExchangeMarker({ exchange, position, color = "#ffcc00", onClick }: Props) {
// //   const ref = useRef<Mesh | null>(null);
// //   const [hover, setHover] = useState(false);

// //   // small idle animation (slow pulse)
// //   useFrame(({ clock }) => {
// //     if (ref.current) {
// //       const s = hover ? 1.6 : 1.0 + Math.sin(clock.getElapsedTime() * 3 + (exchange.id.length % 7)) * 0.07;
// //       ref.current.scale.set(s, s, s);
// //     }
// //   });

// //   return (
// //     <group position={position} onPointerOver={(e) => { e.stopPropagation(); setHover(true); }} onPointerOut={(e) => { e.stopPropagation(); setHover(false); }} onClick={(e) => { e.stopPropagation(); onClick?.(exchange); }}>
// //       {/* marker: small sphere */}
// //       <mesh ref={ref}>
// //         <sphereGeometry args={[0.02, 12, 12]} />
// //         <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} metalness={0.2} roughness={0.6} />
// //       </mesh>

// //       {/* Hover tooltip using Html from drei */}
// //       {hover && (
// //         <Html distanceFactor={8} transform occlude>
// //           <div className="bg-white/95 text-slate-800 text-xs p-2 rounded shadow">
// //             <div className="font-semibold">{exchange.name}</div>
// //             <div className="text-[11px] text-slate-600">{exchange.city ? `${exchange.city}, ` : ""}{exchange.country}</div>
// //             <div className="text-[11px] mt-1"><span className="font-medium">Cloud:</span> {exchange.cloud}</div>
// //           </div>
// //         </Html>
// //       )}
// //     </group>
// //   );
// // }


// // "use client";
// // import React, { useRef, useState } from "react";
// // import { useFrame } from "@react-three/fiber";
// // import { Html } from "@react-three/drei";

// // export default function ExchangeMarker({
// //   exchange,
// //   position,
// //   color,
// //   onClick,
// // }: {
// //   exchange: any;
// //   position: [number, number, number];
// //   color: string;
// //   onClick: () => void;
// // }) {
// //   const meshRef = useRef<any>(null);
// //   const [hover, setHover] = useState(false);


// //   // Subtle pulsing animation for visibility
// //   useFrame(({ clock }) => {
// //     const t = clock.getElapsedTime();
// //     if (meshRef.current) {
// //       meshRef.current.scale.setScalar(1 + 0.2 * Math.sin(t * 2));
// //     }
// //   });

// //   return (
// //     <group position={position} onClick={onClick}>
// //       {/* Brighter and larger sphere marker */}
// //       <mesh ref={meshRef}>
// //         <sphereGeometry args={[0.07, 20, 20]} /> {/* size increased from 0.04 */}
// //         <meshStandardMaterial
// //           color={color}
// //           emissive={color}
// //           emissiveIntensity={1.2}   // brighter glow
// //           roughness={0.3}
// //           metalness={0.8}
// //         />
// //       </mesh>

// //       {/* Optional small label above marker */}
// //       {/* <Html distanceFactor={8}>
// //         <div
// //           className="text-[10px] font-medium text-white drop-shadow-md"
// //           style={{ transform: "translate(-50%, -100%)", whiteSpace: "nowrap" }}
// //         >
// //           {exchange.symbol || exchange.name}
// //         </div>
// //       </Html> */}
// //     </group>
// //   );
// // }


// // src/components/ExchangeMarker.tsx
// "use client";
// import React, { useRef } from "react";
// import { useFrame } from "@react-three/fiber";
// import { Html } from "@react-three/drei";
// import type { ExchangeMeta } from "../lib/store";
// import { Mesh } from "three";

// type Props = {
//   exchange: ExchangeMeta;
//   position: [number, number, number];
//   color: string;
//   onClick?: (id: string) => void;
//   visible?: boolean;
// };

// export default function ExchangeMarker({ exchange, position, color, onClick, visible = true }: Props) {
//   const meshRef = useRef<Mesh | null>(null);

//   useFrame(({ clock }) => {
//     const t = clock.getElapsedTime();
//     if (meshRef.current) {
//       // subtle pulse
//       const s = 1 + 0.12 * Math.sin(t * 3 + (exchange.id.length % 8));
//       meshRef.current.scale.setScalar(s);
//       // rotate slowly for slight visual
//       meshRef.current.rotation.y = t * 0.2;
//     }
//   });

//   if (!visible) return null;

//   return (
//     <group position={position} onClick={(e) => { e.stopPropagation(); onClick?.(exchange.id); }}>
//       <mesh ref={meshRef}>
//         <sphereGeometry args={[0.08, 18, 18]} />
//         <meshStandardMaterial
//           color={color}
//           emissive={color}
//           emissiveIntensity={1.1}
//           roughness={0.25}
//           metalness={0.6}
//         />
//       </mesh>

//       {/* small label above marker (always shown when zoomed enough via distanceFactor) */}
//       <Html distanceFactor={6} style={{ pointerEvents: "none" }}>
//         <div style={{
//           transform: "translate(-50%, -140%)",
//           padding: "2px 6px",
//           background: "rgba(0,0,0,0.6)",
//           color: "white",
//           fontSize: 5,
//           borderRadius: 4,
//           whiteSpace: "nowrap",
//         }}>
//           {exchange.symbol ?? exchange.name}
//         </div>
//       </Html>
//     </group>
//   );
// }

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


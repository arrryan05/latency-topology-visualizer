// src/components/Map3D.tsx
"use client";
import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { useStore } from "../lib/store";
import { latLngToVector3 } from "../lib/geo";
import ExchangeMarker from "./ExchangeMarker";
import * as THREE from "three";
import Legend from "./Legend";
import LatencyChart from "./LatencyChart";
import { connectLatencyStream, disconnectLatencyStream } from "../lib/probes";
import { ZoomButtons } from "./ZoomButtons";
import PerformancePanel from "./PerformancePanel";
import { exportSamplesCSV } from "../lib/storage";

type MarkerData = { id: string; ex: any; pos: [number, number, number] };

/**
 * Map3D - top-level component
 */
export default function Map3D() {
  const exchanges = useStore((s) => s.exchanges);
  const regions = useStore((s) => s.regions);

  const markerData = useMemo(
    () =>
      exchanges.map((ex) => ({
        id: ex.id,
        ex,
        pos: latLngToVector3(ex.lat, ex.lng, 1.8),
      })) as MarkerData[],
    [exchanges]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  // expose debug helpers
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__connectLatencyStream = connectLatencyStream;
    (window as any).__disconnectLatencyStream = disconnectLatencyStream;
    (window as any).__USE_STORE = useStore;
    return () => {
      try {
        delete (window as any).__connectLatencyStream;
        delete (window as any).__disconnectLatencyStream;
        delete (window as any).__USE_STORE;
      } catch { }
    };
  }, []);

  // connect when markers exist
  useEffect(() => {
    if (markerData.length === 0) return;
    connectLatencyStream();
    return () => disconnectLatencyStream();
  }, [markerData.length]);

  // block wheel / pinch on container to avoid native zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-[calc(100vh-80px)]">
      <Canvas camera={{ position: [0, 0, 4.8], fov: 45 }}>
        <InnerScene markerData={markerData} regions={regions} />
        <Stars />
      </Canvas>

      <ZoomButtons />
      <PerformancePanel />
      <SelectedCardUI />
    </div>
  );
}

/* ---------------------------
   InnerScene: arcs built as THREE.Line primitives
   Region bubbles reverted to prior "bubble + torus ring" style (no Html/labels)
   ExchangeMarker usage restored as before
   Adds front/back facing filter so only front hemisphere visuals are shown
----------------------------*/

function InnerScene({ markerData, regions }: { markerData: MarkerData[]; regions: any[] }) {
  const mapTex = useTexture("/assets/earth_day_4096.jpg");
  const setSelected = useStore((s) => s.setSelectedExchangeId);
  const selectedId = useStore((s) => s.selectedExchangeId);
  const filters = useStore((s) => s.filters);
  const latestLatency = useStore((s) => s.latestLatency);

  // refs for controls & camera
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  // tiny state used to trigger React re-render at reduced frame frequency
  const [, setTick] = useState(0);
  const frameCounter = useRef(0);

  /* --------------------------
     HEATMAP (B1) setup
     -------------------------- */
  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const heatSphereRef = useRef<THREE.Mesh | null>(null);
  const CANVAS_W = 2048;
  const CANVAS_H = 1024;
  const lastDrawRef = useRef(0);

  const ensureHeatCanvas = () => {
    if (!typeof window) return null;
    if (!heatCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = CANVAS_W;
      c.height = CANVAS_H;
      heatCanvasRef.current = c;
    }
    if (!heatTextureRef.current && heatCanvasRef.current) {
      heatTextureRef.current = new THREE.CanvasTexture(heatCanvasRef.current);
      heatTextureRef.current.wrapS = THREE.RepeatWrapping;
      heatTextureRef.current.wrapT = THREE.RepeatWrapping;
      heatTextureRef.current.needsUpdate = true;
    }
    return { canvas: heatCanvasRef.current!, tex: heatTextureRef.current! };
  };

  // convert lat/lng -> equirectangular canvas xy
  const latLngToUVxy = (lat: number, lng: number) => {
    const u = (lng + 180) / 360;
    const v = 1 - (lat + 90) / 180;
    return { x: Math.floor(u * CANVAS_W), y: Math.floor(v * CANVAS_H) };
  };

  const colorForLatency = (ms: number) => {
    const minMs = 10;
    const maxMs = 500;
    const t = Math.max(0, Math.min(1, (ms - minMs) / (maxMs - minMs)));
    if (t < 0.5) {
      const sub = t / 0.5;
      const r = Math.round(16 + (245 - 16) * sub);
      const g = Math.round(185 + (190 - 185) * sub);
      const b = Math.round(129 - 129 * sub);
      return `rgba(${r},${g},${b},`;
    } else {
      const sub = (t - 0.5) / 0.5;
      const r = Math.round(245 - 6 * sub);
      const g = Math.round(190 - 190 * sub);
      const b = 0;
      return `rgba(${r},${g},${b},`;
    }
  };

  const redrawHeatmap = () => {
    // throttle to ~6 FPS
    const now = performance.now();
    if (now - lastDrawRef.current < 150) return;
    lastDrawRef.current = now;

    const en = ensureHeatCanvas();
    if (!en) return;
    const { canvas, tex } = en;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";

    // Draw gradients per latestLatency entry at exchange positions
    const entries = Object.entries(latestLatency);
    for (const [id, s] of entries) {
      if (!s) continue;
      const md = markerData.find((m) => m.id === id);
      if (!md) continue;
      const { x, y } = latLngToUVxy(md.ex.lat, md.ex.lng);
      const ms = s.ms ?? 200;
      const intensity = Math.max(0.06, Math.min(1, (ms - 10) / 500));
      const baseRadius = Math.round(Math.max(36, 20 + intensity * 160));
      const grad = ctx.createRadialGradient(x, y, 0, x, y, baseRadius);
      const col = colorForLatency(ms);
      grad.addColorStop(0, `${col} ${Math.min(0.95, 0.35 + intensity * 0.6)})`);
      grad.addColorStop(0.4, `${col} ${Math.min(0.5, 0.15 + intensity * 0.35)})`);
      grad.addColorStop(1, `${col} 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // commit texture update
    tex.needsUpdate = true;
  };

  /* --------------------------
     ARCS (exchange -> region) and TOPOLOGY (exchange <-> exchange)
     -------------------------- */
  const arcsRef = useRef<Record<string, {
    points: THREE.Vector3[];
    pulse: number;
    geom?: THREE.BufferGeometry;
    mat?: THREE.LineBasicMaterial;
    line?: THREE.Line;
  }>>({});

  const topologyRef = useRef<Record<string, {
    points: THREE.Vector3[];
    pulse: number;
    geom?: THREE.BufferGeometry;
    mat?: THREE.LineBasicMaterial;
    line?: THREE.Line;
    pulseMesh?: THREE.Mesh;
  }>>({});

  // register camera & zoom handlers
  function CameraRegistrar() {
    const { camera } = useThree();
    cameraRef.current = camera;
    const setZoomHandlers = useStore((s) => s.setZoomHandlers);

    useEffect(() => {
      if (!setZoomHandlers) return;
      const smoothStep = (dir: number) => {
        if (!cameraRef.current || !controlsRef.current) return;
        const target = controlsRef.current.target ? controlsRef.current.target.clone() : new THREE.Vector3(0, 0, 0);
        const camPos = cameraRef.current.position.clone();
        const dirVec = camPos.clone().sub(target).normalize();
        const delta = dir * 0.6;
        const newPos = camPos.clone().addScaledVector(dirVec, delta);

        const start = camPos.clone();
        const end = newPos.clone();
        const duration = 220;
        const startTime = performance.now();
        const animate = () => {
          const now = performance.now();
          const t = Math.min(1, (now - startTime) / duration);
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          cameraRef.current!.position.lerpVectors(start, end, eased);
          if (controlsRef.current) controlsRef.current.update();
          if (t < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      };

      const handlers = {
        zoomIn: () => smoothStep(-1),
        zoomOut: () => smoothStep(+1),
      };

      setZoomHandlers(handlers);
      return () => setZoomHandlers({ zoomIn: () => { }, zoomOut: () => { } });
    }, [setZoomHandlers]);

    return null;
  }

  // provider color helper
  const providerColor = (provider?: string) => {
    if (!provider) return "#ffcc00";
    const p = provider.toLowerCase();
    if (p.includes("aws")) return "#FF6A00";
    if (p.includes("gcp") || p.includes("google")) return "#00C853";
    if (p.includes("azure") || p.includes("microsoft")) return "#3B82F6";
    return "#FFD54F";
  };

  // visible map (filters)
  const visibleMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    const { providers, search } = filters;
    const searchLower = (search || "").toLowerCase();
    markerData.forEach((md) => {
      let visible = true;
      if (providers.length > 0) visible = providers.includes(md.ex.cloud as any);
      if (searchLower) {
        const s = `${md.ex.name} ${md.ex.city ?? ""} ${md.ex.country ?? ""} ${md.ex.region ?? ""}`.toLowerCase();
        visible = visible && s.includes(searchLower);
      }
      map[md.id] = visible;
    });
    return map;
  }, [markerData, filters]);

  // build arcs (exchange -> region) — same as before
  useEffect(() => {
    // dispose prev
    const prev = arcsRef.current;
    Object.values(prev).forEach(a => {
      try {
        a.line && a.line.geometry && (a.line.geometry as any).dispose && (a.line.geometry as any).dispose();
        a.mat && a.mat.dispose && a.mat.dispose();
      } catch { }
    });

    const out: typeof arcsRef.current = {};
    const R = 1.8;
    const ARC_HEIGHT = 0.45;
    const EPS = 0.02;

    const regionVecs = (regions || []).map((r: any) => {
      const v = new THREE.Vector3(...latLngToVector3(r.lat, r.lng, R)).normalize();
      return { region: r, vec: v };
    });

    for (const md of markerData) {
      let region = (regions || []).find((r: any) => {
        if (!r || !r.code || !md.ex.region) return false;
        return String(r.code).toLowerCase() === String(md.ex.region).toLowerCase();
      });

      if (!region && regionVecs.length > 0) {
        const srcVec = new THREE.Vector3(...md.pos).normalize();
        let best: any = null;
        let bestAng = Infinity;
        for (const rv of regionVecs) {
          const ang = srcVec.angleTo(rv.vec);
          if (ang < bestAng) {
            bestAng = ang;
            best = rv.region;
          }
        }
        region = best;
      }

      if (!region) continue;

      const a = new THREE.Vector3(...md.pos).normalize().multiplyScalar(R + EPS);
      const b = new THREE.Vector3(...latLngToVector3(region.lat, region.lng, R)).normalize().multiplyScalar(R + EPS);
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R + ARC_HEIGHT);

      const curve = new THREE.CatmullRomCurve3([a, mid, b]);
      const pts = curve.getPoints(140).map((p) => {
        const n = p.clone().normalize();
        const radius = Math.max(R + EPS, p.length());
        return n.multiplyScalar(radius);
      });

      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      });
      const line = new THREE.Line(geom, mat);
      line.renderOrder = 2;

      out[md.id] = { points: pts, pulse: Math.random(), geom, mat, line };
    }

    arcsRef.current = out;
  }, [markerData, regions]);

  // build topology edges (exchange <-> exchange) — ensure pulseMesh is created & initialized
  useEffect(() => {
    // dispose prev
    const prev = topologyRef.current;
    Object.values(prev).forEach(e => {
      try {
        e.line && e.line.geometry && (e.line.geometry as any).dispose && (e.line.geometry as any).dispose();
        e.mat && e.mat.dispose && e.mat.dispose();
        e.pulseMesh && e.pulseMesh.geometry && (e.pulseMesh.geometry as any).dispose && (e.pulseMesh.geometry as any).dispose();
      } catch { }
    });

    const out: typeof topologyRef.current = {};
    if (markerData.length < 2) {
      topologyRef.current = out;
      return;
    }

    const K = 3;
    const R = 1.8;
    const EPS = 0.02;
    const ARC_HEIGHT = 0.15;

    const mdVecs = markerData.map(m => ({ id: m.id, posVec: new THREE.Vector3(...m.pos).normalize(), md: m }));

    for (const aMd of mdVecs) {
      const others = mdVecs
        .filter(o => o.id !== aMd.id)
        .map(o => ({ id: o.id, ang: aMd.posVec.angleTo(o.posVec), md: o.md }));

      others.sort((x, y) => x.ang - y.ang);
      const neighbors = others.slice(0, Math.min(K, others.length));

      for (const n of neighbors) {
        const key = [aMd.id, n.id].sort().join("::");
        if (out[key] || topologyRef.current[key]) continue;

        const a = aMd.posVec.clone().multiplyScalar(R + EPS);
        const b = new THREE.Vector3(...n.md.pos).normalize().multiplyScalar(R + EPS);
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R + ARC_HEIGHT + Math.min(0.35, n.ang * 0.6));

        const curve = new THREE.CatmullRomCurve3([a, mid, b]);
        const pts = curve.getPoints(80).map((p) => {
          const nrm = p.clone().normalize();
          const radius = Math.max(R + EPS, p.length());
          return nrm.multiplyScalar(radius);
        });

        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
          color: "#A3A3A3",
          linewidth: 1.2,
          transparent: true,
          opacity: 0.6,
          depthTest: false,
          depthWrite: false,
        });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 1;

        // create pulse mesh and position it at the first point to initialize
        const sphereGeom = new THREE.SphereGeometry(0.02, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 1 });
        const pulseMesh = new THREE.Mesh(sphereGeom, sphereMat);
        pulseMesh.renderOrder = 3;
        // initialize position to first point so it shows up immediately
        if (pts.length > 0) {
          pulseMesh.position.set(pts[0].x, pts[0].y, pts[0].z);
        }

        out[key] = { points: pts, pulse: Math.random() * 0.9, geom, mat, line, pulseMesh };
      }
    }

    topologyRef.current = out;
  }, [markerData]);

  // helper: determine if a world position is roughly in front of camera
  const isFacingCamera = (worldPos: THREE.Vector3, threshold = 0.05) => {
    const cam = cameraRef.current;
    if (!cam) return true;
    const camDir = new THREE.Vector3();
    cam.getWorldDirection(camDir);
    const dirToPoint = worldPos.clone().sub(cam.position).normalize();
    return camDir.dot(dirToPoint) > threshold;
  };

  // animate pulses, update materials, toggle visibility, and update heatmap
  useFrame((_, delta) => {
    frameCounter.current++;

    // redraw heatmap if enabled (throttled inside)
    if (filters.showHeatmap) {
      try { redrawHeatmap(); } catch (e) { /* ignore */ }
    }

    // arcs pulse update
    for (const id of Object.keys(arcsRef.current)) {
      const arc = arcsRef.current[id];
      const sample = latestLatency[id];
      const latencyMs = sample?.ms ?? 200;
      const speed = 0.6 * (200 / Math.max(latencyMs, 10)) + 0.2;
      arc.pulse = (arc.pulse + delta * speed) % 1.0;
      const c = latencyColor(latencyMs);
      try { arc.mat && arc.mat.color && arc.mat.color.set(c); } catch { }
      if (arc.points && arc.line && cameraRef.current) {
        const mid = arc.points[Math.floor(arc.points.length / 2)];
        arc.line.visible = isFacingCamera(mid, 0.06);
      }
    }

    // topology pulse update
    if (filters.showTopology) {
      for (const key of Object.keys(topologyRef.current)) {
        const edge = topologyRef.current[key];
        const speed = 0.9;
        edge.pulse = (edge.pulse + delta * speed) % 1.0;
        const idx = Math.floor(edge.pulse * (edge.points.length - 1));
        const p = edge.points[Math.max(0, Math.min(edge.points.length - 1, idx))];
        if (edge.pulseMesh) {
          edge.pulseMesh.position.set(p.x, p.y, p.z);
        }
        try { edge.mat && edge.mat.color && edge.mat.color.set("#9CA3AF"); } catch { }
        if (edge.points && edge.line && cameraRef.current) {
          const mid = edge.points[Math.floor(edge.points.length / 2)];
          const vis = isFacingCamera(mid, 0.06);
          edge.line.visible = vis;
          if (edge.pulseMesh) edge.pulseMesh.visible = vis;
        }
      }
    }

    // every few frames update JSX-visible parts (markers/regions)
    if (frameCounter.current % 6 === 0) {
      setTick(t => t + 1);
    }
  });

  // selection camera focus
  useEffect(() => {
    if (!selectedId) return;
    const md = markerData.find((m) => m.id === selectedId);
    if (!md) return;
    if (!cameraRef.current || !controlsRef.current) return;
    const [x, y, z] = md.pos;
    const targetVec = new THREE.Vector3(x, y, z);
    const camDistance = 3.0;
    const camPos = targetVec.clone().normalize().multiplyScalar(camDistance);

    const startPos = cameraRef.current.position.clone();
    const startTarget = controlsRef.current.target ? controlsRef.current.target.clone() : new THREE.Vector3(0, 0, 0);
    const duration = 450;
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const t = Math.min(1, (now - startTime) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      cameraRef.current!.position.lerpVectors(startPos, camPos, eased);
      if (controlsRef.current) {
        const lerpedTarget = new THREE.Vector3().lerpVectors(startTarget, targetVec, eased);
        controlsRef.current.target.copy(lerpedTarget);
        controlsRef.current.update();
      }
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [selectedId, markerData]);

  const latencyColor = (ms: number) => {
    if (ms < 80) return "#00ff7f";
    if (ms < 160) return "#ffd700";
    return "#ff6347";
  };

  // cleanup heat texture on unmount
  useEffect(() => {
    return () => {
      try {
        if (heatTextureRef.current) {
          heatTextureRef.current.dispose();
          heatTextureRef.current = null;
        }
        if (heatCanvasRef.current) {
          heatCanvasRef.current = null;
        }
      } catch { }
    };
  }, []);

  // ensure canvas/texture created when heatmap toggled on
  useEffect(() => {
    if (filters.showHeatmap) {
      ensureHeatCanvas();
      try { redrawHeatmap(); } catch { }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.showHeatmap]);

  return (
    <>
      <CameraRegistrar />

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.9} />

      {/* Globe */}
      <mesh>
        <sphereGeometry args={[1.8, 64, 64]} />
        {mapTex ? <meshStandardMaterial map={mapTex} metalness={0} roughness={0.9} /> : <meshStandardMaterial color="#0b3d91" />}
      </mesh>

      {/* Heatmap overlay sphere */}
      {filters.showHeatmap && heatTextureRef.current && (
        <mesh ref={heatSphereRef} position={[0, 0, 0]}>
          <sphereGeometry args={[1.805, 64, 64]} />
          <meshBasicMaterial
            map={heatTextureRef.current}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Regions (soft translucent bubble + torus ring) - only show if facing camera */}
      {filters.showRegions &&
        regions?.map((r: any, i: number) => {
          const R = 1.8;
          const v = new THREE.Vector3(...latLngToVector3(r.lat, r.lng, R)).normalize();
          const offset = 0.045;
          const pos = v.clone().multiplyScalar(R + offset);
          const col = providerColor(r.provider);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
          const facing = cameraRef.current ? isFacingCamera(pos, 0.06) : true;
          if (!facing) return null;
          return (
            <group key={`region-${i}`} position={[pos.x, pos.y, pos.z]}>
              <mesh>
                <sphereGeometry args={[0.18, 32, 32]} />
                <meshStandardMaterial
                  color={col}
                  transparent
                  opacity={0.25}
                  emissive={col}
                  emissiveIntensity={0.9}
                  metalness={0}
                  roughness={0.5}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              <mesh quaternion={q}>
                <torusGeometry args={[0.08, 0.008, 8, 64]} />
                <meshStandardMaterial
                  color={col}
                  transparent
                  opacity={0.12}
                  emissive={col}
                  emissiveIntensity={1.1}
                  metalness={0.1}
                  roughness={0.2}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })}

      {/* Arcs + pulses (exchange->region) */}
      {Object.entries(arcsRef.current).map(([exId, arcData]) => {
        const pts = arcData.points;
        if (!pts || pts.length < 2) return null;
        const idx = Math.floor(arcData.pulse * (pts.length - 1));
        const pos = pts[idx];
        const sample = latestLatency[exId];
        const ms = sample?.ms ?? 200;
        const color = latencyColor(ms);

        return (
          <group key={`arc-${exId}`} renderOrder={2}>
            {arcData.line ? <primitive object={arcData.line} /> : null}
            {cameraRef.current && !isFacingCamera(pos, 0.06) ? null : (
              <mesh position={[pos.x, pos.y, pos.z]} renderOrder={3}>
                <sphereGeometry args={[0.035, 10, 10]} />
                <meshStandardMaterial emissive={color} emissiveIntensity={1.2} color={color} depthTest={false} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Topology edges (exchange <-> exchange) */}
      {filters.showTopology &&
        Object.entries(topologyRef.current).map(([k, edge]) => {
          return (
            <group key={`topo-${k}`} renderOrder={1}>
              {edge.line ? <primitive object={edge.line} /> : null}
              {edge.pulseMesh ? <primitive object={edge.pulseMesh} /> : null}
            </group>
          );
        })}

      {/* Markers: only render markers that face camera */}
      {markerData.map(({ id, ex, pos }) => {
        const world = new THREE.Vector3(...pos);
        const facing = cameraRef.current ? isFacingCamera(world, 0.06) : true;
        if (!facing) return null;
        return (
          <ExchangeMarker
            key={id}
            exchange={ex}
            position={pos}
            color={providerColor(ex.cloud)}
            onClick={() => setSelected(id)}
            visible={visibleMap[id]}
          />
        );
      })}

      {/* Controls */}
      <OrbitControls ref={controlsRef} makeDefault enablePan enableRotate enableZoom={false} />
    </>
  );
}




/* ---------------------------
   SelectedCardUI (outside Canvas) - centered on screen when shown
   LatencyChart will therefore be visually in the middle
----------------------------*/
function SelectedCardUI() {
  const selectedId = useStore((s) => s.selectedExchangeId);
  const exchanges = useStore((s) => s.exchanges);
  const setSelected = useStore((s) => s.setSelectedExchangeId);
  const ex = exchanges.find((e) => e.id === selectedId);
  const [compareWith, setCompareWith] = useState<string | null>(null);

  if (!ex) return null;

  const otherExchanges = exchanges.filter((e) => e.id !== ex.id);

  const downloadCSV = async () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 1);
    try {
      const csv = await exportSamplesCSV(ex.id, from.toISOString(), to.toISOString());
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (ex.id || "latency").replace(/\s+/g, "-");
      a.download = `${safeName}-${from.toISOString()}_${to.toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("export CSV failed", err);
      alert("Export failed — check console.");
    }
  };

  return (
    <div
      className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 p-4 rounded shadow-md w-[min(85vw,720px)] z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold">{ex.name}</div>
          <div className="text-xs text-slate-600">{ex.city ? `${ex.city}, ` : ""}{ex.country}</div>
        </div>
        <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-800">✕</button>
      </div>

      <div className="mt-3">
        <div className="text-sm mb-2 flex items-center gap-2">
          <strong>Cloud:</strong> <span>{ex.cloud}</span>
          <span>•</span>
          <strong>Region:</strong> <span>{ex.region || "—"}</span>
          <button onClick={downloadCSV} className="ml-auto px-2 py-1 bg-slate-100 rounded text-sm">Export CSV</button>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <div className="text-xs font-medium">Compare with:</div>
          <select value={compareWith ?? ""} onChange={(e) => setCompareWith(e.target.value || null)} className="px-2 py-1 text-sm rounded bg-slate-100">
            <option value="">— none —</option>
            {otherExchanges.slice(0, 40).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} {o.city ? `• ${o.city}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="h-[52vh] overflow-hidden rounded" style={{ background: "transparent" }}>
          <LatencyChart dstExchangeId={ex.id} compareDstExchangeId={compareWith} />
        </div>
      </div>
    </div>
  );
}

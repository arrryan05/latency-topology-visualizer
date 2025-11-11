// src/app/page.tsx
"use client";

import { useEffect } from "react";
import Map3D from "../components/Map3D";
import ControlPanel from "../components/ControlPanel";
import exchanges from "../data/exchanges.json";
import regions from "../data/regions.json";
import { useStore } from "../lib/store";

export default function Page() {
  const setExchanges = useStore((s) => s.setExchanges);
  const setRegions = useStore((s) => s.setRegions);

  useEffect(() => {
    setExchanges(exchanges as any);
    setRegions(regions as any);
  }, [setExchanges, setRegions]);

  return (
    <main className="min-h-screen">
      <header className="p-4 bg-white/80 backdrop-blur-sm fixed w-full z-20">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-lg font-semibold">Latency Topology Visualizer</h1>
        </div>
      </header>

      <div className="pt-20">
        <Map3D />
      </div>

      <ControlPanel />
    </main>
  );
}

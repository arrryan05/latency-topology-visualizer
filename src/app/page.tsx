// // src/app/page.tsx
// "use client";

// import { useEffect } from "react";
// import Map3D from "../components/Map3D";
// import ControlPanel from "../components/ControlPanel";
// import exchanges from "../data/exchanges.json";
// import regions from "../data/regions.json";
// import { useStore } from "../lib/store";
// import PerformancePanel from "@/components/PerformancePanel";

// export default function Page() {
//   const setExchanges = useStore((s) => s.setExchanges);
//   const setRegions = useStore((s) => s.setRegions);

//   useEffect(() => {
//     setExchanges(exchanges as any);
//     setRegions(regions as any);
//   }, [setExchanges, setRegions]);

//   return (
//     <main className="min-h-screen">
//       <header className="p-4 bg-white/20 backdrop-blur-sm fixed w-full z-20">
//         <div className="max-w-6xl mx-auto">
//           <h1 className="text-lg font-semibold">Latency Topology Visualizer</h1>
//         </div>
//       </header>

//       <div className="pt-20">
//         <Map3D />
//       </div>

//       <ControlPanel />
//       <PerformancePanel />
//     </main> 
//   );
// }


// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Map3D from "../components/Map3D";
import ControlPanel from "../components/ControlPanel";
import exchanges from "../data/exchanges.json";
import regions from "../data/regions.json";
import { useStore } from "../lib/store";
import PerformancePanel from "@/components/PerformancePanel";

export default function Page() {
  const setExchanges = useStore((s) => s.setExchanges);
  const setRegions = useStore((s) => s.setRegions);
  const wsConnected = useStore((s) => s.wsConnected);
  const clearSelection = useStore((s) => s.setSelectedExchangeId);
  const setSelectedRegionCode = useStore((s) => s.setSelectedRegionCode);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setExchanges(exchanges as any);
    setRegions(regions as any);
    const t = setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(t);
  }, [setExchanges, setRegions]);

  const onResetView = () => {
    clearSelection(null);
    setSelectedRegionCode(null);
  };

  return (
    <main className="min-h-screen">
      {/* Transparent header (show globe behind it) */}
      <header className="fixed top-0 left-0 right-0 z-50 pointer-events-auto">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center">
          {/* H1 has a translucent background to keep it readable over the globe */}
          <h1 className="text-lg font-semibold px-3 py-1 rounded bg-white/80 text-slate-900">
            Latency Topology Visualizer
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm text-slate-700">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${wsConnected ? "bg-emerald-500" : "bg-rose-400"}`} />
              {wsConnected ? "Live" : "Disconnected"}
            </div>

            <button onClick={onResetView} className="px-2 py-1 rounded bg-slate-100 text-sm hover:bg-slate-200">
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Map (fills viewport behind header) */}
      <div className="pt-0">
        <Map3D />
      </div>

      {/* Floating control panel and performance panel still rendered in DOM (they overlay the map via Map3D z-index) */}
      <ControlPanel />
      <PerformancePanel />

    </main>
  );
}

// src/components/PerformancePanel.tsx
"use client";
import React from "react";
import { useStore } from "../lib/store";
import { connectLatencyStream, disconnectLatencyStream } from "../lib/probes";

export default function PerformancePanel() {
  const wsConnected = useStore((s) => s.wsConnected);
  const demoMode = useStore((s) => s.demoMode);
  const latestCount = Object.keys(useStore.getState().latestLatency || {}).length;
  const setDemoMode = useStore((s) => s.setDemoMode);

  const handleToggleDemo = () => {
    setDemoMode(!demoMode);
    if (!demoMode) {
      disconnectLatencyStream();
      // letting connectLatencyStream decide fallback (demo generator)
      connectLatencyStream();
    } else {
      // turning demo off: try connect to ws
      connectLatencyStream();
    }
  };

  return (
    <div className="absolute right-4 top-20 z-40 w-64 bg-white/20 p-3 rounded shadow-md text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Status</div>
        <div className="text-xs text-slate-600">Live</div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>WS</div>
          <div className={`text-xs font-medium ${wsConnected ? "text-green-600" : "text-amber-600"}`}>
            {wsConnected ? "connected" : (demoMode ? "demo" : "disconnected")}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>Samples</div>
          <div className="text-xs">{latestCount}</div>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            className="flex-1 px-2 py-1 rounded bg-slate-100 text-sm"
            onClick={() => connectLatencyStream()}
          >
            Connect
          </button>
          <button
            className="flex-1 px-2 py-1 rounded bg-slate-100 text-sm"
            onClick={() => disconnectLatencyStream()}
          >
            Disconnect
          </button>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <label className="text-xs">Demo</label>
          <input type="checkbox" checked={demoMode} onChange={handleToggleDemo} />
        </div>
      </div>
    </div>
  );
}

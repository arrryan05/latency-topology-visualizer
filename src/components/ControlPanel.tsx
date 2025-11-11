// src/components/ControlPanel.tsx
"use client";
import React, { useMemo, useState } from "react";
import { useStore, Provider as ProviderType } from "../lib/store";
import Fuse from "fuse.js";

const PROVIDERS: ProviderType[] = ["AWS", "GCP", "Azure", "Other"];

export default function ControlPanel() {
  const exchanges = useStore((s) => s.exchanges);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const setSelected = useStore((s) => s.setSelectedExchangeId);

  const [query, setQuery] = useState(filters.search || "");

  const fuse = useMemo(() => {
    return new Fuse(exchanges, { keys: ["name", "id", "city", "country", "region"], threshold: 0.3 });
  }, [exchanges]);

  const results = query ? fuse.search(query).slice(0, 8).map((r) => r.item) : [];

  function toggleProvider(p: ProviderType) {
    const next = filters.providers.includes(p) ? filters.providers.filter((x) => x !== p) : [...filters.providers, p];
    setFilters({ providers: next });
  }

  function onSelectExchange(id: string) {
    setSelected(id);
    setQuery("");
    setFilters({ search: "" });
  }

  return (
    <div className="absolute left-4 top-20 z-30 w-72 bg-white/20 p-3 rounded shadow-md">
      <div className="font-semibold mb-2">Controls</div>

      <div className="mb-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFilters({ search: e.target.value });
          }}
          placeholder="Search exchanges..."
          className="w-full px-2 py-1 border rounded text-sm"
        />
        {query && results.length > 0 && (
          <div className="mt-2 max-h-40 overflow-auto border rounded-sm bg-white">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectExchange(r.id)}
                className="w-full text-left text-sm p-2 hover:bg-slate-100 flex items-center gap-2"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-slate-500 ml-auto">({r.city ?? r.region ?? r.id})</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className="text-xs font-medium mb-1">Providers</div>
        <div className="flex gap-2 flex-wrap">
          {PROVIDERS.map((p) => {
            const active = filters.providers.includes(p);
            return (
              <button
                key={p}
                onClick={() => toggleProvider(p)}
                className={`px-2 py-1 rounded text-sm ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-slate-600 mb-1">Layers</div>
      <div className="flex flex-col gap-1">
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={filters.showRegions} onChange={(e) => setFilters({ showRegions: e.target.checked })} />
          <span>Regions</span>
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={filters.showRealtime} onChange={(e) => setFilters({ showRealtime: e.target.checked })} />
          <span>Real-time (demo)</span>
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={filters.showHistorical} onChange={(e) => setFilters({ showHistorical: e.target.checked })} />
          <span>Historical (local)</span>
        </label>

        {/* heatmap (B1) */}
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!filters.showHeatmap}
            onChange={(e) => setFilters({ showHeatmap: e.target.checked })}
          />
          <span>Latency heatmap</span>
        </label>

        {/* topology (B2) */}
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!filters.showTopology}
            onChange={(e) => setFilters({ showTopology: e.target.checked })}
          />
          <span>Network topology</span>
        </label>
      </div>
    </div>
  );
}

// src/lib/store.ts
import { create } from "zustand";

export type Provider = "AWS" | "GCP" | "Azure" | "Other";

export interface ExchangeMeta {
  id: string;
  name: string;
  cloud: Provider | string;
  region?: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
  probeUrl?: string;
  symbol?: string;
}

export interface LatencySample {
  dstExchangeId: string;
  ms: number;
  ts: string;
}

type Filters = {
  providers: Provider[];
  search: string;
  showRegions: boolean;
  showRealtime: boolean;
  showHistorical: boolean;
  showHeatmap: boolean; // <-- ADDED for B1
  showTopology?: boolean;
};

type State = {
  exchanges: ExchangeMeta[];
  regions: any[];
  filters: Filters;
  selectedExchangeId: string | null;

  // latest latency store (per exchange id)
  latestLatency: Record<string, LatencySample | undefined>;

  // demo toggle
  demoMode: boolean;

  // connection status (set by probes)
  wsConnected: boolean;

  // selected region (code) when user clicks region bubble
  selectedRegionCode: string | null;

  resetCamera?: () => void;
  setResetCamera?: (fn: (() => void) | undefined) => void;

  // zoom handlers (set by Map3D camera registrar)
  zoomIn?: () => void;
  zoomOut?: () => void;
  setZoomHandlers?: (h: { zoomIn: () => void; zoomOut: () => void }) => void;

  // actions
  setExchanges: (e: ExchangeMeta[]) => void;
  setRegions: (r: any[]) => void;
  setFilters: (f: Partial<Filters>) => void;
  setSelectedExchangeId: (id: string | null) => void;
  addSample: (s: LatencySample) => void;

  // demo mode setter
  setDemoMode: (v: boolean) => void;

  // ws connected setter
  setWsConnected: (v: boolean) => void;

  // selected region setter
  setSelectedRegionCode: (code: string | null) => void;
};

export const useStore = create<State>((set, get) => ({
  exchanges: [],
  regions: [],
  filters: {
    providers: [],
    search: "",
    showRegions: true,
    showRealtime: true,
    showHistorical: false,
    showHeatmap: false, // <-- default off
    showTopology: false,
  },
  selectedExchangeId: null,
  latestLatency: {},
  demoMode: false,
  wsConnected: false,
  selectedRegionCode: null,

  zoomIn: undefined,
  zoomOut: undefined,
  setZoomHandlers: (h) => set({ zoomIn: h.zoomIn, zoomOut: h.zoomOut }),

  resetCamera: undefined,
  setResetCamera: (fn) => set({ resetCamera: fn }),

  setExchanges: (e) => set({ exchanges: e }),
  setRegions: (r) => set({ regions: r }),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
  setSelectedExchangeId: (id) => set({ selectedExchangeId: id }),
  setDemoMode: (v) => set({ demoMode: v }),

  setWsConnected: (v) => set({ wsConnected: v }),
  setSelectedRegionCode: (code) => set({ selectedRegionCode: code }),

  addSample: (s) =>
    set((st) => ({
      latestLatency: { ...st.latestLatency, [s.dstExchangeId]: s },
    })),
}));

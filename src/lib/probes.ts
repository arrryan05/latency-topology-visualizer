// // src/lib/probes.ts
// import type { LatencySample } from "./store";
// import { useStore } from "./store";
// import { saveSample } from "./storage";

// let ws: WebSocket | null = null;
// let reconnectTimer: number | null = null;
// let backoff = 1000;
// const MAX_BACKOFF = 30000;
// let heartbeatTimer: number | null = null;
// let demoTimer: number | null = null;

// // determine default WS URL for dev (localhost) or env override
// const DEFAULT_WS =
//   typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
//     ? `ws://localhost:${process.env.NEXT_PUBLIC_PROBE_PORT || "8081"}/ws`
//     : (process.env.NEXT_PUBLIC_PROBE_WS_URL || "");

// // helper to persist + add to store
// function handleIncomingSample(sample: LatencySample) {
//   if (!sample || !sample.dstExchangeId) return;
//   // store
//   try {
//     useStore.getState().addSample(sample);
//   } catch (e) {
//     // swallow
//   }
//   // persist (async)
//   try {
//     saveSample(sample).catch(() => {});
//   } catch {}
// }

// // Demo generator: periodically emit synthetic samples for each exchange
// function startDemoGenerator(intervalMs = 3000) {
//   stopDemoGenerator();
//   const store = useStore.getState();
//   const exchanges = store.exchanges || [];
//   demoTimer = window.setInterval(() => {
//     const now = new Date().toISOString();
//     for (const ex of exchanges) {
//       // create a plausible ms value based on provider / random
//       const base = 120; // ms
//       const jitter = Math.round(Math.random() * 300);
//       const ms = Math.max(10, base + jitter - (ex.cloud && String(ex.cloud).toLowerCase().includes("aws") ? 20 : 0));
//       const sample: LatencySample = { dstExchangeId: ex.id, ms, ts: now };
//       handleIncomingSample(sample);
//     }
//   }, intervalMs);
//   console.debug("[probes] demo generator started");
// }

// function stopDemoGenerator() {
//   if (demoTimer) {
//     clearInterval(demoTimer);
//     demoTimer = null;
//     console.debug("[probes] demo generator stopped");
//   }
// }

// // schedule reconnect with backoff
// function scheduleReconnect() {
//   if (reconnectTimer) return;
//   backoff = Math.min(MAX_BACKOFF, Math.max(1000, Math.floor(backoff * 1.8)));
//   const delay = backoff + Math.floor(Math.random() * 800);
//   reconnectTimer = window.setTimeout(() => {
//     reconnectTimer = null;
//     connectLatencyStream();
//   }, delay);
//   console.debug(`[probes] reconnect scheduled in ${delay}ms`);
// }

// // HEARTBEAT (pings server to keep connection alive)
// function startHeartbeat() {
//   stopHeartbeat();
//   heartbeatTimer = window.setInterval(() => {
//     try {
//       if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "ping" }));
//     } catch {}
//   }, 20_000);
// }
// function stopHeartbeat() {
//   if (heartbeatTimer) {
//     clearInterval(heartbeatTimer);
//     heartbeatTimer = null;
//   }
// }

// /**
//  * Connect to the probe server or start demo generator if demoMode enabled.
//  * - If demoMode -> start demo generator and do not create a WS.
//  * - Otherwise try connecting to configured WS URL.
//  */
// export function connectLatencyStream(wsUrl?: string) {
//   const store = useStore.getState();
//   if (store.demoMode) {
//     // demo mode -> generate synthetic samples
//     console.debug("[probes] demoMode enabled — starting demo generator");
//     stopWS();
//     startDemoGenerator(3000);
//     return;
//   }

//   // If already connected, skip
//   if (ws) {
//     if (ws.readyState === ws.OPEN) return;
//     // if connecting or closing, let it be
//   }

//   // clear demo if running
//   stopDemoGenerator();

//   const url = wsUrl || DEFAULT_WS;
//   if (!url) {
//     console.warn("[probes] no websocket url configured; enable demoMode for local demo");
//     // fallback to demo if no URL
//     startDemoGenerator(3000);
//     return;
//   }

//   try {
//     ws = new WebSocket(url);
//   } catch (err) {
//     console.warn("[probes] ws connect error", err);
//     scheduleReconnect();
//     return;
//   }

//   ws.onopen = () => {
//     console.info("[probes] connected to probe server", url);
//     backoff = 1000;
//     // start heartbeat
//     startHeartbeat();
//     // request a snapshot (server may send latestSnapshot)
//     try {
//       ws!.send(JSON.stringify({ type: "requestLatest" }));
//     } catch {}
//   };

//   ws.onmessage = (ev) => {
//     try {
//       const payload = JSON.parse(ev.data);
//       if (!payload) return;
//       if (payload.type === "latestSnapshot" && payload.latest) {
//         // latest is object keyed by dstExchangeId
//         const latest = payload.latest;
//         Object.keys(latest).forEach((k) => {
//           const s = latest[k];
//           if (s && s.dstExchangeId) handleIncomingSample(s as LatencySample);
//         });
//       } else if (payload.type === "latency" && payload.sample) {
//         handleIncomingSample(payload.sample as LatencySample);
//       } else if (payload.type === "pong") {
//         // ignore
//       } else {
//         // unknown type - ignore
//       }
//     } catch (err) {
//       console.warn("[probes] ws parse error", err);
//     }
//   };

//   ws.onclose = (ev) => {
//     console.warn("[probes] ws closed", ev && (ev as CloseEvent).reason);
//     ws = null;
//     stopHeartbeat();
//     scheduleReconnect();
//   };

//   ws.onerror = (err) => {
//     console.warn("[probes] ws error", err);
//     // try to close and schedule reconnect
//     if (ws) {
//       try {
//         ws.close();
//       } catch {}
//       ws = null;
//     }
//     stopHeartbeat();
//     scheduleReconnect();
//   };
// }

// // helper to immediately stop ws without scheduling reconnect
// function stopWS() {
//   if (reconnectTimer) {
//     clearTimeout(reconnectTimer);
//     reconnectTimer = null;
//   }
//   if (!ws) return;
//   try {
//     ws.close();
//   } catch {}
//   ws = null;
//   stopHeartbeat();
// }

// /**
//  * Disconnect WS & stop demo generator
//  */
// export function disconnectLatencyStream() {
//   stopDemoGenerator();
//   stopWS();
// }


// src/lib/probes.ts
import type { LatencySample } from "./store";
import { useStore } from "./store";
import { saveSample } from "./storage";

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let backoff = 1000;
const MAX_BACKOFF = 30000;
let heartbeatTimer: number | null = null;
let demoTimer: number | null = null;

const DEFAULT_WS =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? `ws://localhost:${process.env.NEXT_PUBLIC_PROBE_PORT || "8081"}/ws`
    : (process.env.NEXT_PUBLIC_PROBE_WS_URL || "");

function handleIncomingSample(sample: LatencySample) {
  if (!sample || !sample.dstExchangeId) return;
  try {
    useStore.getState().addSample(sample);
  } catch {}
  try {
    saveSample(sample).catch(() => {});
  } catch {}
}

function startDemoGenerator(intervalMs = 3000) {
  stopDemoGenerator();
  const store = useStore.getState();
  const exchanges = store.exchanges || [];
  demoTimer = window.setInterval(() => {
    const now = new Date().toISOString();
    for (const ex of exchanges) {
      const base = 120;
      const jitter = Math.round(Math.random() * 320);
      const providerAdj = ex.cloud && String(ex.cloud).toLowerCase().includes("aws") ? -20 : 0;
      const ms = Math.max(8, base + jitter + providerAdj);
      const sample: LatencySample = { dstExchangeId: ex.id, ms, ts: now };
      handleIncomingSample(sample);
    }
  }, intervalMs);
  // indicate not connected (demo mode)
  useStore.getState().setWsConnected(false);
  console.debug("[probes] demo generator started");
}

function stopDemoGenerator() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
    console.debug("[probes] demo generator stopped");
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  backoff = Math.min(MAX_BACKOFF, Math.max(1000, Math.floor(backoff * 1.8)));
  const delay = backoff + Math.floor(Math.random() * 800);
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectLatencyStream();
  }, delay);
  console.debug(`[probes] reconnect scheduled in ${delay}ms`);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    try {
      if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    } catch {}
  }, 20_000);
}
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function connectLatencyStream(wsUrl?: string) {
  const store = useStore.getState();
  if (store.demoMode) {
    console.debug("[probes] demoMode enabled — starting demo generator");
    stopWS();
    startDemoGenerator(3000);
    return;
  }

  stopDemoGenerator();

  if (ws) {
    if (ws.readyState === ws.OPEN) return;
  }

  const url = wsUrl || DEFAULT_WS;
  if (!url) {
    console.warn("[probes] no websocket url configured; enabling demo generator as fallback");
    startDemoGenerator(3000);
    return;
  }

  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.warn("[probes] ws connect error", err);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.info("[probes] connected to probe server", url);
    backoff = 1000;
    useStore.getState().setWsConnected(true);
    startHeartbeat();
    try { ws!.send(JSON.stringify({ type: "requestLatest" })); } catch {}
  };

  ws.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      if (!payload) return;
      if (payload.type === "latestSnapshot" && payload.latest) {
        const latest = payload.latest;
        Object.keys(latest).forEach((k) => {
          const s = latest[k];
          if (s && s.dstExchangeId) handleIncomingSample(s as LatencySample);
        });
      } else if (payload.type === "latency" && payload.sample) {
        handleIncomingSample(payload.sample as LatencySample);
      }
    } catch (err) {
      console.warn("[probes] ws parse error", err);
    }
  };

  ws.onclose = (ev) => {
    console.warn("[probes] ws closed", ev && (ev as CloseEvent).reason);
    ws = null;
    useStore.getState().setWsConnected(false);
    stopHeartbeat();
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.warn("[probes] ws error", err);
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }
    useStore.getState().setWsConnected(false);
    stopHeartbeat();
    scheduleReconnect();
  };
}

function stopWS() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (!ws) return;
  try {
    ws.close();
  } catch {}
  ws = null;
  stopHeartbeat();
  useStore.getState().setWsConnected(false);
}

export function disconnectLatencyStream() {
  stopDemoGenerator();
  stopWS();
}

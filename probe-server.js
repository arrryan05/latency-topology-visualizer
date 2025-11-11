// probe-server.js
// Dev/demo probe server — runs standalone in Node (dev-only). Probes exchanges server-side and broadcasts via WebSocket.
// Usage: node probe-server.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const WebSocket = require("ws");
const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

const PORT = process.env.PROBE_PORT ? parseInt(process.env.PROBE_PORT) : 8081;
const PROBE_INTERVAL_MS = process.env.PROBE_INTERVAL_MS ? parseInt(process.env.PROBE_INTERVAL_MS) : 7000;
const CONCURRENCY = 6;
const HISTORY_LIMIT = 2000; // per exchange

// load exchanges file (adjust path if needed)
const exchangesPath = path.join(__dirname, "src", "data", "exchanges.json");
let exchanges = [];
try {
  exchanges = JSON.parse(fs.readFileSync(exchangesPath, "utf8"));
  console.log(`Loaded ${exchanges.length} exchanges from ${exchangesPath}`);
} catch (err) {
  console.error("Failed to load exchanges.json:", err && err.message);
  process.exit(1);
}

// in-memory latest and history
const latest = {}; // { [exchangeId]: { dstExchangeId, ms, ts } }
const history = {}; // { [exchangeId]: [samples...] }
for (const ex of exchanges) history[ex.id] = [];

function nowTs() { return new Date().toISOString(); }

// probe function (server-side)
async function probeUrl(url, timeout = 5000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    // HEAD sometimes blocked, use GET but don't parse body
    const res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow" });
    clearTimeout(id);
    // we don't stream body; measuring response time is the key
    const ms = Math.max(1, Date.now() - start);
    return { success: true, ms, status: res.status };
  } catch (err) {
    // treat as unreachable — still return a value to indicate failure
    const ms = Math.max(1, Date.now() - start);
    return { success: false, ms, error: err && (err.message || String(err)) };
  }
}

// run a cycle of probes (concurrent)
async function runCycle() {
  if (!exchanges || exchanges.length === 0) return;
  let idx = 0;
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (idx < exchanges.length) {
        const i = idx++;
        const ex = exchanges[i];
        const url = ex.probeUrl || ex.probeUrl === "" ? ex.probeUrl : ex.probeUrl || ex.url || `https://example.com/`;
        // pick a sensible default endpoint: if an API time endpoint is present, use it
        const probeTarget = ex.probeUrl || ex.probeUrl === "" ? ex.probeUrl : ex.probeUrl || ex.url || ex.probeUrl || `https://example.com/`;
        let result;
        try {
          // ensure probeTarget is a valid string
          const target = (ex.probeUrl && typeof ex.probeUrl === "string") ? ex.probeUrl : (ex.url || `https://example.com/`);
          result = await probeUrl(target, 5000);
        } catch (e) {
          result = { success: false, ms: 2000, error: String(e) };
        }
        const sample = { dstExchangeId: ex.id, ms: result.ms, ts: nowTs(), ok: !!result.success };
        latest[ex.id] = sample;
        const arr = history[ex.id] || [];
        arr.push(sample);
        // cap history length
        if (arr.length > HISTORY_LIMIT) arr.splice(0, arr.length - HISTORY_LIMIT);
        history[ex.id] = arr;
        // broadcast sample to connected ws clients (done in outer loop)
        broadcastSample(sample);
        // slight pause to avoid bursts
        await new Promise(r => setTimeout(r, 30));
      }
    })());
  }
  await Promise.all(workers);
}

// WebSocket / HTTP server setup
const app = express();
// allow simple CORS for HTTP endpoints
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// REST endpoints for convenience
app.get("/latest", (req, res) => {
  res.json({ latest });
});

app.get("/history/:id", (req, res) => {
  const id = req.params.id;
  const from = req.query.from ? new Date(req.query.from).getTime() : 0;
  const to = req.query.to ? new Date(req.query.to).getTime() : Date.now();
  const arr = (history[id] || []).filter(s => {
    const t = new Date(s.ts).getTime();
    return t >= from && t <= to;
  });
  res.json({ id, count: arr.length, samples: arr });
});

const server = app.listen(PORT, () => {
  console.log(`Probe server HTTP listening on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server, path: "/ws" });
wss.on("connection", (ws, req) => {
  console.log("WS client connected");
  // on connect, send the whole latest snapshot
  try {
    ws.send(JSON.stringify({ type: "latestSnapshot", latest }));
  } catch (e) {}
  ws.on("close", () => console.log("WS client disconnected"));
});

function broadcastSample(sample) {
  const payload = JSON.stringify({ type: "latency", sample });
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(payload);
    }
  });
}

// Start periodic runner
console.log(`Starting probe loop every ${PROBE_INTERVAL_MS} ms`);
setInterval(() => {
  runCycle().catch(err => console.error("runCycle error", err && err.message));
}, PROBE_INTERVAL_MS);

// run initial cycle immediately
runCycle().catch(err => console.error("runCycle error", err && err.message));

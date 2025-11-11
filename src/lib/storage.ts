// src/lib/storage.ts
// Lightweight IndexedDB wrapper for storing latency samples.
// Sample shape: { dstExchangeId: string, ms: number, ts: string (ISO), ok: boolean, meta?: any }

const DB_NAME = "latency-topology-db";
const DB_VERSION = 1;
const STORE_NAME = "samples";

type Sample = {
  dstExchangeId: string;
  ms: number;
  ts: string; // ISO
  ok?: boolean;
  meta?: Record<string, any>;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        // indexes for queries
        store.createIndex("dst_ts", ["dstExchangeId", "ts"], { unique: false });
        store.createIndex("ts", "ts", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function initDB(): Promise<void> {
  await openDB();
}

// Save a sample (non-blocking)
export async function saveSample(sample: Sample): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    // store object will contain sample + createdAt
    const record = { ...sample, createdAt: new Date().toISOString() };
    store.add(record);
    // no need to await completion for speed, but handle errors
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[storage] saveSample failed:", err);
  }
}

// Query samples for a dstExchangeId within [fromISO, toISO] inclusive
export async function querySamples(dstExchangeId: string, fromISO: string, toISO: string): Promise<Array<any>> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const ix = store.index("dst_ts");
  const lower = [dstExchangeId, fromISO];
  const upper = [dstExchangeId, toISO];
  const keyRange = IDBKeyRange.bound(lower, upper);
  const results: Array<any> = [];
  return new Promise((resolve, reject) => {
    const cursorReq = ix.openCursor(keyRange, "next");
    cursorReq.onsuccess = (e) => {
      const c = (e.target as any).result;
      if (!c) {
        resolve(results);
        return;
      }
      // push with fields expected by charts: ms, ts, ok, dstExchangeId
      results.push({
        ms: c.value.ms,
        ts: c.value.ts,
        ok: c.value.ok ?? true,
        dstExchangeId: c.value.dstExchangeId,
        meta: c.value.meta ?? null,
      });
      c.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// Export CSV as string (columns: ts,ms,ok,dstExchangeId)
export async function exportSamplesCSV(dstExchangeId: string, fromISO: string, toISO: string): Promise<string> {
  const rows = await querySamples(dstExchangeId, fromISO, toISO);
  const header = ["ts", "ms", "ok", "dstExchangeId"];
  const out = [header.join(",")];
  for (const r of rows) {
    const line = [r.ts, String(r.ms), r.ok ? "1" : "0", r.dstExchangeId].map(v => {
      // escape quotes
      if (typeof v === "string" && v.includes(",")) {
        return `"${v.replaceAll('"', '""')}"`;
      }
      return v;
    }).join(",");
    out.push(line);
  }
  return out.join("\n");
}

// Debug helper to count samples for a dst id
export async function countSamples(dstExchangeId?: string): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  if (!dstExchangeId) {
    return new Promise((res, rej) => {
      const req = store.count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  } else {
    const ix = store.index("dst_ts");
    const lower = [dstExchangeId, "\u0000"];
    const upper = [dstExchangeId, "\uFFFF"];
    return new Promise((res, rej) => {
      const req = ix.count(IDBKeyRange.bound(lower, upper));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
}

// For debugging in console
if (typeof window !== "undefined") {
  (window as any).__storage = { initDB, saveSample, querySamples, exportSamplesCSV, countSamples };
}

// server.js — Dev-only CORS proxy. Do NOT expose this to production.
const express = require("express");
const cors = require("cors");

// dynamic import of node-fetch for compatibility
const fetcher = (...args) => import("node-fetch").then(m => m.default(...args));

const app = express();
app.use(cors()); // allow all origins

app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("missing url param");
  try {
    const upstream = await fetcher(target, { method: "GET" });
    res.status(upstream.status);
    // Forward most headers except content-length to avoid double setting
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase() === "content-length") return;
      res.setHeader(k, v);
    });
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error("proxy error:", err && (err.message || err));
    res.status(502).send("proxy error");
  }
});

const PORT = process.env.PROXY_PORT || 8080;
app.listen(PORT, () => {
  console.log(`CORS proxy running: http://localhost:${PORT}/proxy?url=...`);
});

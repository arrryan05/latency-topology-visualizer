// // src/components/LatencyChart.tsx
// "use client";
// import React, { useEffect, useState, useRef } from "react";
// import { querySamples, initDB } from "../lib/storage";
// import {
//   Chart as ChartJS,
//   TimeScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Tooltip,
//   Legend as CLegend,
//   ChartOptions,
//   ScriptableContext,
// } from "chart.js";
// import 'chartjs-adapter-date-fns';
// import { Line } from "react-chartjs-2";

// ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, CLegend);

// type Props = { dstExchangeId: string };

// function latencyColor(ms: number) {
//   if (ms < 80) return "#10B981"; // green-500
//   if (ms < 160) return "#F59E0B"; // amber-500
//   return "#EF4444"; // red-500
// }

// export default function LatencyChart({ dstExchangeId }: Props) {
//   const [range, setRange] = useState<"1h" | "24h" | "7d" | "30d">("1h");
//   const [data, setData] = useState<any>(null);
//   const [stats, setStats] = useState({ min: 0, max: 0, avg: 0, count: 0 });
//   const wrapperRef = useRef<HTMLDivElement | null>(null);
//   const chartRef = useRef<any>(null);

//   useEffect(() => {
//     // ensure DB available before queries
//     initDB().catch((e) => console.warn("[LatencyChart] initDB failed", e));

//     let to = new Date();
//     let from = new Date();
//     if (range === "1h") from.setHours(from.getHours() - 1);
//     if (range === "24h") from.setDate(from.getDate() - 1);
//     if (range === "7d") from.setDate(from.getDate() - 7);
//     if (range === "30d") from.setDate(from.getDate() - 30);

//     let cancelled = false;
//     (async () => {
//       const samples = await querySamples(dstExchangeId, from.toISOString(), to.toISOString());
//       if (cancelled) return;
//       // reduce points for large ranges
//       const step = samples.length > 500 ? Math.ceil(samples.length / 500) : 1;
//       const filtered = samples.filter((_, i) => i % step === 0);
//       const values = filtered.map((s) => s.ms);
//       const min = values.length ? Math.min(...values) : 0;
//       const max = values.length ? Math.max(...values) : 0;
//       const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
//       setStats({ min, max, avg, count: samples.length });

//       // Build dataset where scriptable properties color segments/points based on value
//       setData({
//         datasets: [
//           {
//             label: "Latency (ms)",
//             data: filtered.map((s) => ({ x: new Date(s.ts).getTime(), y: s.ms })),
//             borderWidth: 3,
//             tension: 0.36,
//             fill: true,
//             backgroundColor: "rgba(59,130,246,0.08)",
//             pointRadius: 3,
//             pointHoverRadius: 6,
//             pointBackgroundColor: (ctx: ScriptableContext<"line">) => {
//               const v = ctx.parsed?.y as number | undefined;
//               return typeof v === "number" ? latencyColor(v) : "#3B82F6";
//             },
//             pointBorderColor: "rgba(255,255,255,0.6)",
//             borderColor: "#3B82F6",
//             segment: {
//               borderColor: (ctx: any) => {
//                 const y = ctx.p1?.parsed?.y;
//                 if (typeof y === "number") return latencyColor(y);
//                 return "#3B82F6";
//               },
//             },
//           },
//         ],
//       });
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, [dstExchangeId, range]);

//   // observe container size so chart updates (wrapperRef separate from chartRef)
//   useEffect(() => {
//     const el = wrapperRef.current;
//     if (!el) return;
//     const ro = new ResizeObserver(() => {
//       // trigger chart update by forcing a new reference to data
//       setData((d: any) => (d ? { ...d } : d));
//     });
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   const options: ChartOptions<"line"> = {
//     parsing: false,
//     maintainAspectRatio: false,
//     interaction: {
//       mode: "nearest",
//       intersect: false,
//     },
//     plugins: {
//       legend: { display: false },
//       tooltip: {
//         callbacks: {
//           title: (items) => {
//             const t = items?.[0]?.parsed?.x;
//             return t ? new Date(t).toLocaleString() : "";
//           },
//           label: (item) => {
//             const y = (item as any).parsed?.y;
//             return ` ${y} ms`;
//           },
//         },
//       },
//     },
//     scales: {
//       x: {
//         type: "time",
//         time: { unit: range === "1h" ? "minute" : "hour", tooltipFormat: "PPpp" },
//         ticks: { color: "#334155" },
//         grid: { color: "rgba(15,23,42,0.04)" },
//       },
//       y: {
//         beginAtZero: true,
//         ticks: { color: "#334155" },
//         grid: { color: "rgba(15,23,42,0.04)" },
//       },
//     },
//   };

//   return (
//     <div className="h-full flex flex-col" ref={wrapperRef}>
//       <div className="flex gap-2 items-center mb-2">
//         <div className="text-sm font-medium">Range:</div>
//         {(["1h","24h","7d","30d"] as const).map((r) => (
//           <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-sm ${range===r ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{r}</button>
//         ))}
//         <div className="ml-auto text-xs text-slate-600">Samples: {stats.count}</div>
//       </div>

//       <div className="flex-1">
//         {data ? (
//           <Line ref={chartRef} data={data} options={options} />
//         ) : (
//           <div className="text-sm text-slate-500 p-4">Loading...</div>
//         )}
//       </div>

//       <div className="mt-2 text-sm text-slate-700">
//         <div>Min: {stats.min} ms • Max: {stats.max} ms • Avg: {stats.avg} ms</div>
//       </div>
//     </div>
//   );
// }


// src/components/LatencyChart.tsx
"use client";
import React, { useEffect, useState, useRef } from "react";
import { querySamples } from "../lib/storage";
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend as CLegend,
  ChartOptions,
} from "chart.js";
import 'chartjs-adapter-date-fns';
import { Line } from "react-chartjs-2";

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, CLegend);

type Props = { dstExchangeId: string; compareDstExchangeId?: string | null };

function latencyColor(ms: number) {
  if (ms < 80) return "#10B981"; // green
  if (ms < 160) return "#F59E0B"; // amber
  return "#EF4444"; // red
}

export default function LatencyChart({ dstExchangeId, compareDstExchangeId }: Props) {
  const [range, setRange] = useState<"1h" | "24h" | "7d" | "30d">("1h");
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState({ min: 0, max: 0, avg: 0, count: 0 });
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let to = new Date();
    let from = new Date();
    if (range === "1h") from.setHours(from.getHours() - 1);
    if (range === "24h") from.setDate(from.getDate() - 1);
    if (range === "7d") from.setDate(from.getDate() - 7);
    if (range === "30d") from.setDate(from.getDate() - 30);

    (async () => {
      const base = await querySamples(dstExchangeId, from.toISOString(), to.toISOString());
      const comp = compareDstExchangeId ? await querySamples(compareDstExchangeId, from.toISOString(), to.toISOString()) : [];
      const step = Math.max(1, Math.ceil(Math.max(base.length, comp.length) / 500));

      const filteredBase = base.filter((_, i) => i % step === 0);
      const filteredComp = comp.filter((_, i) => i % step === 0);

      const values = filteredBase.map((s) => s.ms);
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 0;
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      setStats({ min, max, avg, count: base.length });

      const datasets: any[] = [];

      datasets.push({
        label: "Latency (selected)",
        data: filteredBase.map((s) => ({ x: new Date(s.ts).getTime(), y: s.ms })),
        borderWidth: 3,
        tension: 0.32,
        fill: true,
        backgroundColor: "rgba(59,130,246,0.08)",
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: filteredBase.map((s) => latencyColor(s.ms)),
        borderColor: "#3B82F6",
      });

      if (compareDstExchangeId && filteredComp.length) {
        datasets.push({
          label: "Latency (compare)",
          data: filteredComp.map((s) => ({ x: new Date(s.ts).getTime(), y: s.ms })),
          borderWidth: 2,
          tension: 0.28,
          fill: false,
          borderDash: [6, 6],
          pointRadius: 2,
          pointBackgroundColor: filteredComp.map((s) => latencyColor(s.ms)),
          borderColor: "#A78BFA",
        });
      }

      setData({ datasets });
    })();
  }, [dstExchangeId, compareDstExchangeId, range]);

  // ensure Chart resizes to parent
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setData((d: any) => (d ? { ...d } : d));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const options: ChartOptions<"line"> = {
    parsing: false,
    maintainAspectRatio: false,
    interaction: {
      mode: "nearest",
      intersect: false,
    },
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: {
        callbacks: {
          title: (items) => {
            const t = items?.[0]?.parsed?.x;
            return t ? new Date(t).toLocaleString() : "";
          },
          label: (item) => {
            const y = (item as any).parsed?.y;
            return ` ${y} ms`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        time: { unit: range === "1h" ? "minute" : "hour", tooltipFormat: "PPpp" },
        ticks: { color: "#0f172a" },
        grid: { color: "rgba(15,23,42,0.04)" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#0f172a" },
        grid: { color: "rgba(15,23,42,0.04)" },
      },
    },
  };

  return (
    <div className="h-full flex flex-col" ref={chartRef}>
      <div className="flex gap-2 items-center mb-2">
        <div className="text-sm font-medium">Range:</div>
        {(["1h","24h","7d","30d"] as const).map(r => (
          <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-sm ${range===r ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{r}</button>
        ))}
        <div className="ml-auto text-xs text-slate-600">Samples: {stats.count}</div>
      </div>

      <div className="flex-1">
        {data ? (
          <Line
            data={data}
            options={options}
          />
        ) : (
          <div className="text-sm text-slate-500 p-4">Loading...</div>
        )}
      </div>

      <div className="mt-2 text-sm text-slate-700">
        <div>Min: {stats.min} ms • Max: {stats.max} ms • Avg: {stats.avg} ms</div>
      </div>
    </div>
  );
}

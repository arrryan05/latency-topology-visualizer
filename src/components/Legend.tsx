// src/components/Legend.tsx
"use client";
export default function Legend() {
  return (
    <div className="absolute top-4 right-4 bg-white/90 p-3 rounded shadow-md w-40 text-sm z-30">
      <div className="font-semibold mb-2">Legend</div>
      <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 bg-[#FF6A00] inline-block rounded-sm" /> AWS</div>
      <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 bg-[#00C853] inline-block rounded-sm" /> GCP</div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#3B82F6] inline-block rounded-sm" /> Azure</div>
    </div>
  );
}

// inside Map3D component's return (DOM overlay area), add:
import { useStore } from "../lib/store";

export function ZoomButtons() {
  const zoomIn = useStore(s => s.zoomIn);
  const zoomOut = useStore(s => s.zoomOut);

  return (
    <div className="absolute left-4 bottom-6 z-40 flex flex-col gap-2">
      <button
        onClick={() => zoomIn && zoomIn()}
        className="w-10 h-10 bg-white/90 rounded shadow flex items-center justify-center text-xl font-bold"
        title="Zoom in"
      >
        +
      </button>
      <button
        onClick={() => zoomOut && zoomOut()}
        className="w-10 h-10 bg-white/90 rounded shadow flex items-center justify-center text-xl font-bold"
        title="Zoom out"
      >
        −
      </button>
    </div>
  );
}

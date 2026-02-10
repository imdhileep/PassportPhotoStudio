import { useState } from "react";

export default function BeforeAfterSlider() {
  const [split, setSplit] = useState(55);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="relative h-64 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600" />
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        >
          <div className="h-full w-full bg-gradient-to-br from-sky-300 via-violet-300 to-emerald-300" />
        </div>
        <div className="absolute inset-0 flex items-center">
          <div className="relative w-full">
            <div
              className="absolute left-0 top-0 h-full w-1.5 rounded-full bg-white shadow-lg"
              style={{ left: `${split}%` }}
            />
            <div
              className="absolute -top-2 h-8 w-8 -translate-x-1/2 rounded-full border border-white/30 bg-black/40"
              style={{ left: `${split}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
        <span>Before</span>
        <input
          aria-label="Before and after slider"
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(event) => setSplit(Number(event.target.value))}
          className="mx-3 w-full accent-sky-400"
        />
        <span>After</span>
      </div>
    </div>
  );
}

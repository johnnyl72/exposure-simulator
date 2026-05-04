// Live histogram. Reads the exposure state and redraws a tonal
// distribution that shifts right as the image brightens, left as it
// darkens, and spreads as ISO noise rises — with clipping bars at the
// extremes. Sketch styling matches the wireframe `Histogram`.

import { useMemo } from 'react';
import { WF } from '../theme';

const N = 36;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function Histogram({
  w = 220,
  h = 70,
  ev,
  grain = 0,
  clipHigh = false,
  clipLow = false,
  dark = false,
  label = 'HISTOGRAM · RGB',
}: {
  w?: number;
  h?: number;
  ev: number;
  grain?: number;
  clipHigh?: boolean;
  clipLow?: boolean;
  dark?: boolean;
  label?: string;
}) {
  const fg = dark ? '#fff' : WF.ink;
  const dim = dark ? 'rgba(255,255,255,0.3)' : WF.ink3;

  const path = useMemo(() => {
    // Tonal centre shifts with EV; spread widens with grain/noise.
    const center = clamp(0.46 + ev * 0.13, 0.06, 0.94);
    const spread = 3.4 - clamp(grain, 0, 0.55) * 2.2;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      // Deterministic wobble so the curve is stable between renders.
      const wobble = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const v =
        Math.exp(-Math.pow((t - center) * spread, 2)) * 0.85 +
        Math.abs(wobble) * 0.03;
      pts.push([t, v]);
    }
    const line = pts
      .map(([t, v], i) => {
        const px = 4 + t * (w - 8);
        const py = h - 6 - v * (h - 12);
        return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(' ');
    return `${line} L ${w - 4} ${h - 6} L 4 ${h - 6} Z`;
  }, [ev, grain, w, h]);

  return (
    <div style={{ width: w }}>
      <div className="wf-tag" style={{ marginBottom: 4, color: dark ? 'rgba(255,255,255,0.55)' : WF.ink2 }}>
        {label}
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect
          x="0.5"
          y="0.5"
          width={w - 1}
          height={h - 1}
          rx="3"
          fill="transparent"
          stroke={fg}
          strokeWidth="1.4"
        />
        <path d={path} fill={fg} opacity={dark ? 0.8 : 0.65} />
        {[0.25, 0.5, 0.75].map((t, i) => (
          <line
            key={i}
            x1={4 + t * (w - 8)}
            y1="4"
            x2={4 + t * (w - 8)}
            y2={h - 4}
            stroke={dim}
            strokeWidth="0.6"
            strokeDasharray="2 2"
          />
        ))}
        {clipLow && <rect x="4" y="4" width="6" height={h - 8} fill={WF.amber} opacity="0.5" />}
        {clipHigh && (
          <rect x={w - 10} y="4" width="6" height={h - 8} fill={WF.amber} opacity="0.5" />
        )}
      </svg>
    </div>
  );
}

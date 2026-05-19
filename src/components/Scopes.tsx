// Scopes panel — waveform + vectorscope drawn from the exposure model.
// Pedagogically honest: a real videography scope reads pixels off the
// sensor; ours reads what the exposure model says the sensor would see.
// The shapes still teach the right thing — waveform shifts right as you
// add light, vectorscope dot leaves the centre as you mismatch WB.

import { useMemo } from 'react';
import { WF } from '../theme';
import type { Derived } from '../exposure';
import { scopeReadout } from '../exposure';

const W = 320;
const H = 152;
const PAD = 12;
const VEC_R = 56;

export function Scopes({ d }: { d: Derived }) {
  const r = useMemo(() => scopeReadout(d, 42), [d]);
  const waveW = W - 2 * PAD - VEC_R * 2 - 18; // room for vectorscope on right
  const waveH = H - 2 * PAD - 14;
  const colW = waveW / r.waveform.length;
  const baseY = H - PAD;

  const vecCx = W - PAD - VEC_R;
  const vecCy = H / 2 + 2;

  return (
    <div
      style={{
        width: W,
        background: 'rgba(231,227,218,0.92)',
        border: `1.4px solid ${WF.ink}`,
        borderRadius: 10,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px 4px',
          borderBottom: `1px dashed ${WF.ink3}`,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span className="wf-tag">SCOPES</span>
        <span className="wf-tag" style={{ color: WF.ink3 }}>WAVEFORM · VECTORSCOPE</span>
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label="Scopes">
        {/* Waveform frame */}
        <rect
          x={PAD}
          y={PAD + 6}
          width={waveW}
          height={waveH}
          fill="transparent"
          stroke={WF.ink}
          strokeWidth="1.2"
          rx="3"
        />
        {/* 25% / 50% / 75% guides */}
        {[0.25, 0.5, 0.75].map((t, i) => (
          <line
            key={i}
            x1={PAD}
            x2={PAD + waveW}
            y1={PAD + 6 + waveH * (1 - t)}
            y2={PAD + 6 + waveH * (1 - t)}
            stroke={WF.ink3}
            strokeDasharray="2 3"
            strokeWidth="0.7"
          />
        ))}
        {/* Waveform columns */}
        {r.waveform.map((v, i) => {
          const x = PAD + i * colW;
          const h = v * waveH;
          const isClipped = v > 0.95;
          const isCrushed = v < 0.05;
          return (
            <line
              key={i}
              x1={x + colW / 2}
              x2={x + colW / 2}
              y1={baseY}
              y2={baseY - h}
              stroke={isClipped || isCrushed ? WF.amber : WF.ink}
              strokeWidth={Math.max(0.9, colW - 1)}
              opacity={isClipped || isCrushed ? 0.85 : 0.7}
              strokeLinecap="round"
            />
          );
        })}

        {/* Vectorscope */}
        <circle cx={vecCx} cy={vecCy} r={VEC_R} fill="transparent" stroke={WF.ink} strokeWidth="1.2" />
        <circle cx={vecCx} cy={vecCy} r={VEC_R * 0.66} fill="none" stroke={WF.ink3} strokeWidth="0.7" />
        <circle cx={vecCx} cy={vecCy} r={VEC_R * 0.33} fill="none" stroke={WF.ink3} strokeWidth="0.7" />
        {/* Crosshair */}
        <line x1={vecCx - VEC_R} y1={vecCy} x2={vecCx + VEC_R} y2={vecCy} stroke={WF.ink3} strokeWidth="0.6" />
        <line x1={vecCx} y1={vecCy - VEC_R} x2={vecCx} y2={vecCy + VEC_R} stroke={WF.ink3} strokeWidth="0.6" />
        {/* Skin-tone axis: from centre toward orange (~30°). */}
        <line
          x1={vecCx}
          y1={vecCy}
          x2={vecCx + Math.cos((30 * Math.PI) / 180) * VEC_R * 0.92}
          y2={vecCy - Math.sin((30 * Math.PI) / 180) * VEC_R * 0.92}
          stroke={WF.amber}
          strokeWidth="0.9"
          strokeDasharray="2 2"
          opacity="0.55"
        />
        {/* Quadrant labels */}
        <text x={vecCx + VEC_R - 12} y={vecCy - VEC_R + 14} fontFamily={WF.fontMono} fontSize="8" fill={WF.ink3}>
          R
        </text>
        <text x={vecCx - VEC_R + 6} y={vecCy + VEC_R - 6} fontFamily={WF.fontMono} fontSize="8" fill={WF.ink3}>
          B
        </text>
        {/* Live dot */}
        <circle
          cx={vecCx + r.vector.x * VEC_R}
          cy={vecCy - r.vector.y * VEC_R}
          r={r.vector.magnitude > 0.01 ? 4 : 2.5}
          fill={WF.amber}
          stroke={WF.ink}
          strokeWidth="1"
        />

        {/* Waveform clipping callouts */}
        {d.clipHigh && (
          <text x={PAD + 2} y={PAD + 14} fontFamily={WF.fontMono} fontSize="9" fill={WF.amber}>
            ▲ clipping
          </text>
        )}
        {d.clipLow && (
          <text x={PAD + 2} y={baseY - 2} fontFamily={WF.fontMono} fontSize="9" fill={WF.amber}>
            ▼ crushed
          </text>
        )}
      </svg>
    </div>
  );
}

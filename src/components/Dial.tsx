// Interactive sketch dial. Visually faithful to the wireframe `Dial`
// (hand-drawn rim, tick marks, amber active tick + indicator notch),
// but now a real control: drag vertically, scroll, or use arrow keys to
// step through the value ladder. Index-based — the parent decides what
// each index means.

import { useCallback, useId, useRef } from 'react';
import { WF } from '../theme';

const STEP_PX = 20; // vertical drag distance for one stop

export function Dial({
  label,
  valueText,
  index,
  count,
  onChange,
  size = 104,
}: {
  label: string;
  valueText: string;
  index: number;
  count: number;
  onChange: (nextIndex: number) => void;
  size?: number;
}) {
  const id = useId();
  const r = size / 2;
  const tickInner = r - 10;
  const tickOuter = r - 3;
  const drag = useRef<{ startY: number; startIndex: number } | null>(null);

  const clampIdx = useCallback(
    (i: number) => Math.max(0, Math.min(count - 1, i)),
    [count],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startIndex: index };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // Drag up → more light (higher index).
    const steps = Math.round((d.startY - e.clientY) / STEP_PX);
    const next = clampIdx(d.startIndex + steps);
    if (next !== index) onChange(next);
  };
  const endDrag = (e: React.PointerEvent) => {
    drag.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onChange(clampIdx(index + (e.deltaY < 0 ? 1 : -1)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clampIdx(index + 1));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clampIdx(index - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(count - 1);
    }
  };

  const marks = count;
  const activeMark = index;
  const indicatorAngle = (activeMark / marks) * Math.PI * 2 - Math.PI / 2;
  const ix = r + Math.cos(indicatorAngle) * (r - 18);
  const iy = r + Math.sin(indicatorAngle) * (r - 18);

  return (
    <div
      className="wf-dial"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={valueText}
      aria-valuenow={index}
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-describedby={id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      style={{
        position: 'relative',
        width: size,
        height: size + 28,
        userSelect: 'none',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="wf-dial-rim"
          cx={r}
          cy={r}
          r={r - 2}
          fill={WF.paper}
          stroke={WF.ink}
          strokeWidth="1.6"
        />
        <circle
          cx={r}
          cy={r}
          r={r - 2}
          fill="none"
          stroke={WF.ink}
          strokeWidth="0.8"
          opacity="0.4"
          transform="translate(0.6, 0.4)"
        />
        <circle cx={r} cy={r} r={r - 12} fill="none" stroke={WF.ink3} strokeWidth="0.8" />
        {Array.from({ length: marks }).map((_, i) => {
          const a = (i / marks) * Math.PI * 2 - Math.PI / 2;
          const x1 = r + Math.cos(a) * tickInner;
          const y1 = r + Math.sin(a) * tickInner;
          const x2 = r + Math.cos(a) * tickOuter;
          const y2 = r + Math.sin(a) * tickOuter;
          const isActive = i === activeMark;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isActive ? WF.amber : WF.ink}
              strokeWidth={isActive ? 2.4 : 1.2}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={ix} cy={iy} r="3" fill={WF.amber} />
      </svg>
      <div style={{ position: 'absolute', top: r - 12, left: 0, right: 0, textAlign: 'center' }}>
        <div className="wf-mono" style={{ fontSize: 11, color: WF.ink2 }}>
          {label}
        </div>
        <div className="wf-mono" style={{ fontSize: 16, fontWeight: 500, color: WF.ink }}>
          {valueText}
        </div>
      </div>
      <div
        id={id}
        className="wf-tag"
        style={{ position: 'absolute', top: size + 4, left: 0, right: 0, textAlign: 'center' }}
      >
        {label} DIAL
      </div>
    </div>
  );
}

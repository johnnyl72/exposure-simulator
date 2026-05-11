// Compare mode — wireframe's `CompareA` direction. Two independent
// exposures of the same scene, side by side, with a live delta strip
// down the middle so reciprocity (and its breaking points) read at a
// glance. The single best teaching move that wasn't in Phase 1.

import { useState } from 'react';
import { AppChrome, type View } from '../components/AppChrome';
import { Dial } from '../components/Dial';
import { Histogram } from '../components/Histogram';
import { ScenePlaceholder } from '../components/ScenePlaceholder';
import {
  APERTURE_VALUES,
  ISO_VALUES,
  SCENES,
  SHUTTER_VALUES,
  formatAperture,
  formatShutter,
  type Scene,
} from '../exposure';
import { LADDERS, useExposure } from '../useExposure';
import { WF } from '../theme';

type ExposureHook = ReturnType<typeof useExposure>;

const log2 = (x: number) => Math.log(x) / Math.LN2;

export function Compare({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [sceneIdx, setSceneIdx] = useState(3); // Café — DOF shows compare best
  const scene = SCENES[sceneIdx];

  const A = useExposure(scene);
  const B = useExposure(scene);

  // Stop-delta per control between the two panes (positive = B has more
  // of this control's light contribution than A).
  const dShutterStops = log2(B.settings.shutter / A.settings.shutter);
  const dIsoStops = log2(B.settings.iso / A.settings.iso);
  const dApertureStops = 2 * log2(A.settings.aperture / B.settings.aperture);
  const dEv = +(B.d.ev - A.d.ev).toFixed(2);

  // Copy A's three triangle controls onto B (and vice versa). Named for
  // what they *do* — pinAtoB writes to B.
  const pinAtoB = () => {
    B.set.iso(idxOf(ISO_VALUES, A.settings.iso));
    B.set.shutter(idxOf(SHUTTER_VALUES, A.settings.shutter));
    B.set.aperture(idxOf(APERTURE_VALUES, A.settings.aperture));
  };
  const pinBtoA = () => {
    A.set.iso(idxOf(ISO_VALUES, B.settings.iso));
    A.set.shutter(idxOf(SHUTTER_VALUES, B.settings.shutter));
    A.set.aperture(idxOf(APERTURE_VALUES, B.settings.aperture));
  };

  return (
    <div className="wf-art" style={{ overflow: 'auto' }}>
      <AppChrome active="COMPARE" onNavigate={onNavigate} />

      {/* Scene picker bar */}
      <div
        style={{
          position: 'absolute',
          top: 66,
          left: 24,
          right: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div className="wf-tag">SCENE</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SCENES.map((s, i) => {
            const active = i === sceneIdx;
            return (
              <button
                key={s.kind}
                type="button"
                title={`${s.name} — ${s.focus}`}
                aria-pressed={active}
                onClick={() => setSceneIdx(i)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  background: active ? WF.amber : WF.paper,
                  border: `1.4px solid ${active ? WF.amber : WF.ink}`,
                  color: active ? '#fff' : WF.ink,
                  fontFamily: WF.fontHand,
                  fontSize: 17,
                  lineHeight: 1,
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="wf-pill" onClick={pinBtoA} title="Copy B's settings onto A">
            ← pin B → A
          </button>
          <button type="button" className="wf-pill" onClick={pinAtoB} title="Copy A's settings onto B">
            pin A → B →
          </button>
          <button
            type="button"
            className="wf-pill"
            onClick={() => {
              A.set.reset();
              B.set.reset();
            }}
          >
            reset both ↺
          </button>
        </div>
      </div>

      {/* Two-pane comparison */}
      <div
        style={{
          position: 'absolute',
          top: 116,
          left: 24,
          right: 24,
          bottom: 24,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 18,
        }}
      >
        <Pane label="A" tone={WF.ink} {...A} scene={scene} />

        {/* Center delta strip */}
        <div
          style={{
            width: 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            padding: '16px 14px',
            background: 'rgba(231,227,218,0.85)',
            border: `1.4px solid ${WF.ink}`,
            borderRadius: 10,
          }}
        >
          <div className="wf-tag" style={{ marginBottom: 6 }}>Δ B − A</div>
          <div
            className="wf-mono"
            style={{
              fontSize: 28,
              marginBottom: 14,
              color: Math.abs(dEv) < 0.1 ? WF.ink : WF.amber,
            }}
          >
            {dEv >= 0 ? '+' : ''}
            {dEv.toFixed(1)} EV
          </div>
          <DeltaLine label="shutter" stops={dShutterStops} />
          <DeltaLine label="aperture" stops={dApertureStops} />
          <DeltaLine label="ISO" stops={dIsoStops} />
          <hr
            style={{ border: 'none', borderTop: `1px dashed ${WF.ink3}`, margin: '14px 0 10px' }}
          />
          <p className="wf-note" style={{ fontSize: 14, lineHeight: 1.25 }}>
            {Math.abs(dEv) < 0.05 && (Math.abs(dShutterStops) + Math.abs(dApertureStops) > 0.5)
              ? 'Same exposure, different look — that’s the reciprocity law in action.'
              : Math.abs(dEv) < 0.05
                ? 'A and B are identical. Turn a dial on either side.'
                : `B is ${dEv > 0 ? 'brighter' : 'darker'} than A by ${Math.abs(dEv).toFixed(1)} stops.`}
          </p>
        </div>

        <Pane label="B" tone={WF.amber} {...B} scene={scene} />
      </div>
    </div>
  );
}

function idxOf(arr: readonly number[], v: number) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function Pane({
  label,
  tone,
  scene,
  settings,
  idx,
  set,
  d,
}: {
  label: string;
  tone: string;
  scene: Scene;
} & ExposureHook) {
  const nd = LADDERS.nd[settings.ndIndex];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0, // let the scene shrink in narrower viewports
      }}
    >
      {/* Scene + corner badge */}
      <div style={{ position: 'relative', flex: 1, minHeight: 240 }}>
        <ScenePlaceholder scene={scene} d={d} />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: tone,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: WF.fontMono,
            fontSize: 14,
            fontWeight: 600,
            border: `1.4px solid ${WF.ink}`,
          }}
        >
          {label}
        </div>
      </div>

      {/* HUD strip: EV + small histogram + note */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          padding: '10px 14px',
          background: 'rgba(231,227,218,0.85)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 8,
        }}
      >
        <div
          className="wf-mono"
          style={{ fontSize: 22, color: d.clipHigh || d.clipLow ? WF.amber : WF.ink, minWidth: 80 }}
        >
          {d.ev >= 0 ? '+' : ''}
          {d.ev.toFixed(1)} EV
        </div>
        <Histogram
          w={140}
          h={42}
          ev={d.ev}
          grain={d.grainOpacity}
          clipHigh={d.clipHigh}
          clipLow={d.clipLow}
          label={`${label} · HIST`}
        />
        <p
          className="wf-note"
          style={{ fontSize: 13, lineHeight: 1.2, flex: 1, minWidth: 120, margin: 0 }}
        >
          {d.note}
        </p>
      </div>

      {/* Compact dial deck (5 dials — WB lives only in the full Simulator
          to keep this panel readable). */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '12px 14px',
          background: 'rgba(231,227,218,0.85)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 10,
          justifyContent: 'center',
        }}
      >
        <Dial label="ISO" valueText={String(settings.iso)} index={idx.iso} count={LADDERS.iso.length} onChange={set.iso} size={76} />
        <Dial label="SHUT" valueText={formatShutter(settings.shutter)} index={idx.shutter} count={LADDERS.shutter.length} onChange={set.shutter} size={76} />
        <Dial label="APER" valueText={formatAperture(settings.aperture)} index={idx.aperture} count={LADDERS.aperture.length} onChange={set.aperture} size={76} />
        <Dial label="FOCAL" valueText={`${settings.focal}mm`} index={idx.focal} count={LADDERS.focal.length} onChange={set.focal} size={76} />
        <Dial label="ND" valueText={nd.label} index={idx.nd} count={LADDERS.nd.length} onChange={set.nd} size={76} />
      </div>
    </div>
  );
}

function DeltaLine({ label, stops }: { label: string; stops: number }) {
  const rounded = +stops.toFixed(2);
  const isZero = Math.abs(rounded) < 0.05;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '4px 0',
        borderBottom: `1px dashed ${WF.ink3}`,
        fontFamily: WF.fontMono,
        fontSize: 12,
        color: isZero ? WF.ink3 : WF.ink,
      }}
    >
      <span>{label}</span>
      <span style={{ color: isZero ? WF.ink3 : rounded > 0 ? WF.amber : WF.ink }}>
        {isZero ? '·' : `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} stop${Math.abs(rounded) === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}

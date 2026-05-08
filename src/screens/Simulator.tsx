// Exposure Triangle Simulator — the wireframe's "A · Full-bleed scene +
// floating dials" direction (the core interactive tool). Everything here
// is live: pick a scene, turn the five dials, watch the photograph and
// the histogram respond, and read the one-line "why".

import { useEffect, useMemo, useState } from 'react';
import { AppChrome, type View } from '../components/AppChrome';
import { Dial } from '../components/Dial';
import { Histogram } from '../components/Histogram';
import { Scopes } from '../components/Scopes';
import { ScenePlaceholder } from '../components/ScenePlaceholder';
import {
  FPS_VALUES,
  SCENES,
  TONE_PRESETS,
  applyTonePreset,
  formatAperture,
  formatShutter,
  shutterAngle,
  suggestFix,
  type TonePreset,
} from '../exposure';
import { LADDERS, useExposure } from '../useExposure';
import { buildShareUrl, decodeShare, pushShareToUrl } from '../share';
import { WF } from '../theme';

export function Simulator({ onNavigate }: { onNavigate: (v: View) => void }) {
  // Hydrate scene + settings from the URL once, on mount, so any exposure
  // is a link. Subsequent state changes push back via replaceState.
  const initialShare = useMemo(() => decodeShare(window.location.hash), []);
  const [sceneIdx, setSceneIdx] = useState(() =>
    initialShare ? Math.max(0, SCENES.indexOf(initialShare.scene)) : 0,
  );
  const scene = SCENES[sceneIdx];
  const { idx, set, d, settings } = useExposure(scene, initialShare?.settings);

  // Push every change to the URL so what you see is what you share.
  useEffect(() => {
    pushShareToUrl(scene, settings);
  }, [scene, settings]);

  const [copied, setCopied] = useState(false);
  const [scopesOpen, setScopesOpen] = useState(false);
  const [cinemaOn, setCinemaOn] = useState(false);
  const [fpsIdx, setFpsIdx] = useState(0); // 24fps
  const fps = FPS_VALUES[fpsIdx];
  const cinema = useMemo(() => shutterAngle(settings.shutter, fps), [settings.shutter, fps]);

  const [tone, setTone] = useState<TonePreset>('rec709');
  const dToned = useMemo(() => applyTonePreset(d, tone), [d, tone]);
  const copyShare = async () => {
    const url = buildShareUrl(scene, settings);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — pill stays in default state */
    }
  };

  const nd = LADDERS.nd[settings.ndIndex];
  const atIdeal = Math.abs(d.ev) < 0.1 && settings.ndIndex === 0;
  const fix = suggestFix(settings, scene);
  const applyFix = () => {
    if (!fix) return;
    if (fix.control === 'shutter') set.shutter(fix.toIndex);
    else if (fix.control === 'aperture') set.aperture(fix.toIndex);
    else set.iso(fix.toIndex);
  };

  return (
    <div className="wf-art">
      <AppChrome active="PLAY" onNavigate={onNavigate} />

      {/* Full-bleed scene — tone preset is the last stage in the look chain. */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0 }}>
        <ScenePlaceholder scene={scene} d={dToned} rounded={false} />
      </div>

      {/* Scene picker rail */}
      <div
        style={{
          position: 'absolute',
          top: 78,
          left: 24,
          width: 64,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
          background: 'rgba(231,227,218,0.82)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 8,
        }}
      >
        <div className="wf-tag" style={{ textAlign: 'center', marginBottom: 2 }}>
          SCENE
        </div>
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
                width: 48,
                height: 48,
                borderRadius: 5,
                cursor: 'pointer',
                background: active ? WF.amber : WF.paper,
                border: `1.4px solid ${active ? WF.amber : WF.ink}`,
                color: active ? '#fff' : WF.ink,
                fontFamily: WF.fontHand,
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              {s.name[0]}
            </button>
          );
        })}
      </div>

      {/* Exposure HUD */}
      <div
        style={{
          position: 'absolute',
          top: 78,
          right: 24,
          width: 250,
          padding: 16,
          background: 'rgba(231,227,218,0.9)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 8,
        }}
      >
        <div className="wf-tag">EXPOSURE</div>
        <div
          className="wf-mono"
          style={{
            fontSize: 30,
            marginTop: 4,
            marginBottom: 12,
            color: d.clipHigh || d.clipLow ? WF.amber : WF.ink,
          }}
        >
          {d.ev >= 0 ? '+' : ''}
          {d.ev.toFixed(1)} EV
        </div>
        <Histogram
          w={218}
          h={64}
          ev={d.ev}
          grain={d.grainOpacity}
          clipHigh={d.clipHigh}
          clipLow={d.clipLow}
        />
        <p className="wf-note" style={{ fontSize: 15, marginTop: 10 }}>
          {d.note}
        </p>
        {fix && (
          <button
            type="button"
            onClick={applyFix}
            className="wf-pill"
            title={`One-click fix: ${fix.label}`}
            style={{
              marginTop: 10,
              width: '100%',
              justifyContent: 'flex-start',
              borderColor: WF.amber,
              color: WF.amber,
            }}
          >
            <span aria-hidden style={{ fontSize: 12 }}>↳</span>
            <span>try: {fix.label}</span>
          </button>
        )}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="wf-tag">{scene.name.toUpperCase()}</span>
          <button
            type="button"
            className={`wf-pill${atIdeal ? ' wf-active' : ''}`}
            onClick={set.reset}
            title="Restore this scene's correct exposure"
            style={{ padding: '3px 9px', fontSize: 10 }}
          >
            {atIdeal ? 'ideal ✓' : 'reset ↺'}
          </button>
        </div>
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <button
            type="button"
            className={`wf-pill${cinemaOn ? ' wf-active' : ''}`}
            onClick={() => setCinemaOn((v) => !v)}
            title="Treat the camera as a cinema camera (fps + shutter angle)"
            style={{ padding: '3px 9px', fontSize: 10 }}
          >
            cinema {cinemaOn ? '▾' : '▸'}
          </button>
          <button
            type="button"
            className={`wf-pill${scopesOpen ? ' wf-active' : ''}`}
            onClick={() => setScopesOpen((v) => !v)}
            title="Show / hide waveform + vectorscope"
            style={{ padding: '3px 9px', fontSize: 10 }}
          >
            scopes {scopesOpen ? '▾' : '▸'}
          </button>
          <button
            type="button"
            className="wf-pill"
            onClick={copyShare}
            title="Copy a link to this exact exposure"
            style={{ padding: '3px 9px', fontSize: 10 }}
          >
            {copied ? 'copied ✓' : 'share ↗'}
          </button>
        </div>
      </div>

      {/* Control deck */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 20,
          alignItems: 'flex-start',
          padding: '20px 28px',
          background: 'rgba(231,227,218,0.85)',
          backdropFilter: 'blur(4px)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 14,
        }}
      >
        <Dial
          label="ISO"
          valueText={String(settings.iso)}
          index={idx.iso}
          count={LADDERS.iso.length}
          onChange={set.iso}
          size={96}
        />
        <Dial
          label="SHUTTER"
          valueText={formatShutter(settings.shutter)}
          index={idx.shutter}
          count={LADDERS.shutter.length}
          onChange={set.shutter}
          size={96}
        />
        <Dial
          label="APERTURE"
          valueText={formatAperture(settings.aperture)}
          index={idx.aperture}
          count={LADDERS.aperture.length}
          onChange={set.aperture}
          size={96}
        />
        <div style={{ width: 1, alignSelf: 'stretch', background: WF.ink3, margin: '0 4px' }} />
        <Dial
          label="FOCAL"
          valueText={`${settings.focal}mm`}
          index={idx.focal}
          count={LADDERS.focal.length}
          onChange={set.focal}
          size={96}
        />
        <Dial
          label="ND"
          valueText={nd.label}
          index={idx.nd}
          count={LADDERS.nd.length}
          onChange={set.nd}
          size={96}
        />
        <Dial
          label="WB"
          valueText={`${settings.wb}K`}
          index={idx.wb}
          count={LADDERS.wb.length}
          onChange={set.wb}
          size={96}
        />
      </div>

      {/* Look (tone preset) toggle — 709 / LOG / FILM. A pure colour-grade
          lens over the exposure model. Tucked under the scene picker so
          it never overlaps the control deck or HUD. */}
      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 78,
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          background: 'rgba(231,227,218,0.92)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 8,
        }}
      >
        <span className="wf-tag" style={{ alignSelf: 'center', marginRight: 4 }}>LOOK</span>
        {TONE_PRESETS.map((p) => {
          const active = p.id === tone;
          return (
            <button
              key={p.id}
              type="button"
              className={`wf-pill${active ? ' wf-active' : ''}`}
              onClick={() => setTone(p.id)}
              title={p.hint}
              style={{ padding: '3px 9px', fontSize: 10 }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Live, interaction-first coaching line */}
      <div
        className="wf-anno"
        style={{
          position: 'absolute',
          left: 'max(40px, 4vw)',
          bottom: 150,
          maxWidth: 280,
        }}
      >
        {scene.focus} — drag a dial up for more light, down for less.
      </div>

      {/* Floating scopes panel — toggled from the HUD. Sits comfortably
          above the control deck so it can't intercept dial drags. */}
      {scopesOpen && (
        <div style={{ position: 'absolute', left: 108, bottom: 220 }}>
          <Scopes d={d} />
        </div>
      )}

      {/* Cinema panel — fps + shutter-angle readout. The 180° tick is the
          classical cinema sweet spot. Anchored to the bottom of the
          viewport (right side) so it never collides with the HUD. */}
      {cinemaOn && (
        <div
          style={{
            position: 'absolute',
            right: 24,
            bottom: 220,
            width: 250,
            padding: '14px 16px',
            background: 'rgba(231,227,218,0.92)',
            border: `1.4px solid ${WF.ink}`,
            borderRadius: 8,
          }}
        >
          <div className="wf-tag" style={{ marginBottom: 6 }}>CINEMA</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <div
              className="wf-mono"
              style={{
                fontSize: 28,
                color: cinema.feel === 'cinematic' ? WF.amber : WF.ink,
              }}
            >
              {cinema.angleDeg}°
            </div>
            <span className="wf-tag" style={{ color: WF.ink2 }}>
              @ {fps}fps · {formatShutter(settings.shutter)}
            </span>
          </div>
          {/* Sweet-spot meter (0–360°, 180° marker) */}
          <svg width="100%" height="22" viewBox="0 0 220 22" style={{ display: 'block', marginBottom: 8 }}>
            <rect x="0" y="9" width="220" height="6" fill="transparent" stroke={WF.ink} strokeWidth="1" rx="2" />
            <rect x="0" y="9" width={(cinema.angleDeg / 360) * 220} height="6" fill={cinema.feel === 'cinematic' ? WF.amber : WF.ink} opacity="0.85" />
            <line x1={110} y1="3" x2={110} y2="21" stroke={WF.amber} strokeWidth="1.4" />
            <text x="111" y="22" fontFamily={WF.fontMono} fontSize="8" fill={WF.amber}>180°</text>
          </svg>
          <p className="wf-note" style={{ fontSize: 13, lineHeight: 1.2, margin: '4px 0 10px' }}>
            {cinema.note}
          </p>
          <div className="wf-tag" style={{ marginBottom: 4 }}>FPS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {FPS_VALUES.map((f, i) => {
              const active = i === fpsIdx;
              return (
                <button
                  key={f}
                  type="button"
                  className={`wf-pill${active ? ' wf-active' : ''}`}
                  onClick={() => setFpsIdx(i)}
                  style={{ padding: '3px 8px', fontSize: 10 }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Landing / Hero — the wireframe's "A · Full-bleed cinematic" direction
// (the questionnaire's hero pick). Kept in the chosen sketch palette:
// the floating dial trio is genuinely live, so the page delivers its own
// promise — turn a dial, watch the scene change — before you even start.

import { AppChrome, type View } from '../components/AppChrome';
import { Dial } from '../components/Dial';
import { Histogram } from '../components/Histogram';
import { ScenePlaceholder } from '../components/ScenePlaceholder';
import { Callout } from '../components/Callout';
import { SCENES, formatAperture, formatShutter } from '../exposure';
import { LADDERS, useExposure } from '../useExposure';
import { WF } from '../theme';

const HERO_SCENE = SCENES[0]; // Neon Street

export function Hero({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { idx, set, d, settings } = useExposure(HERO_SCENE);

  return (
    <div className="wf-art">
      <AppChrome active="LEARN" onNavigate={onNavigate} />

      <div style={{ position: 'absolute', top: 54, left: 28, right: 28, bottom: 28 }}>
        <ScenePlaceholder scene={HERO_SCENE} d={d} />
      </div>

      {/* Manifesto */}
      <div style={{ position: 'absolute', left: 'max(64px, 6vw)', top: 150, maxWidth: 560 }}>
        <div className="wf-tag" style={{ marginBottom: 14 }}>
          AN INTERACTIVE PHOTOGRAPHY LAB
        </div>
        <h1
          className="wf-hand"
          style={{
            fontSize: 'clamp(48px, 6.4vw, 80px)',
            lineHeight: 0.95,
            letterSpacing: '-0.01em',
            margin: 0,
            color: WF.ink,
          }}
        >
          Learn exposure
          <br />
          by <em style={{ color: WF.amber, fontStyle: 'normal' }}>seeing</em> it.
        </h1>
        <p className="wf-note" style={{ fontSize: 22, marginTop: 18, maxWidth: 420 }}>
          Turn the dials. Watch the scene change. No textbooks — just light.
        </p>
        <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="wf-btn wf-accent" onClick={() => onNavigate('lesson')}>
            Start the lesson →
          </button>
          <button className="wf-btn wf-ghost" onClick={() => onNavigate('sim')}>
            Sandbox mode
          </button>
          <button className="wf-btn wf-ghost" onClick={() => onNavigate('compare')}>
            Compare mode
          </button>
        </div>
      </div>

      {/* Live mirror — proves the manifesto before you scroll: turn a dial
          and both the scene *and* the histogram shift in lockstep. */}
      <div
        style={{
          position: 'absolute',
          top: 86,
          right: 'max(40px, 4vw)',
          padding: '10px 12px 8px',
          background: 'rgba(231,227,218,0.88)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 8,
        }}
      >
        <Histogram
          w={188}
          h={54}
          ev={d.ev}
          grain={d.grainOpacity}
          clipHigh={d.clipHigh}
          clipLow={d.clipLow}
          label="LIVE HISTOGRAM"
        />
        <div
          className="wf-mono"
          style={{
            fontSize: 11,
            marginTop: 4,
            textAlign: 'right',
            color: d.clipHigh || d.clipLow ? WF.amber : WF.ink2,
          }}
        >
          {d.ev >= 0 ? '+' : ''}
          {d.ev.toFixed(1)} EV
        </div>
      </div>

      <Callout
        text={'live preview reacts\nthe moment you turn ↓'}
        style={{ right: 'max(60px, 5vw)', top: 218, width: 200, textAlign: 'right' }}
      />

      {/* Floating, fully-live dial trio */}
      <div
        style={{
          position: 'absolute',
          bottom: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 34,
          padding: '24px 38px',
          background: 'rgba(231,227,218,0.78)',
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
        />
        <Dial
          label="SHUTTER"
          valueText={formatShutter(settings.shutter)}
          index={idx.shutter}
          count={LADDERS.shutter.length}
          onChange={set.shutter}
        />
        <Dial
          label="APERTURE"
          valueText={formatAperture(settings.aperture)}
          index={idx.aperture}
          count={LADDERS.aperture.length}
          onChange={set.aperture}
        />
      </div>

      {/* Bottom rail hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 'max(64px, 6vw)',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <span
          className="wf-mono"
          style={{ fontSize: 10, color: WF.ink2, letterSpacing: '0.15em' }}
        >
          SCROLL · LESSON 1 OF 6
        </span>
        <div style={{ width: 80, height: 2, background: WF.ink3 }}>
          <div style={{ width: '16%', height: '100%', background: WF.amber }} />
        </div>
      </div>
    </div>
  );
}

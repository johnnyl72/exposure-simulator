// Sketch scene placeholder — the hatched "image goes here" panel from
// the wireframe, now wired to the exposure engine AND given per-scene
// iconography so the six worlds are visually distinct. Each scene has
// its own background composition (drawn into the bg plane so DOF +
// motion filters still apply naturally) and its own subject glyph.
//
// Motion blur is axis-aware (horizontal smear for a moving subject or
// pan, vertical wash for a waterfall) via an inline SVG filter, so the
// panning scene actually streaks the background while the subject stays
// sharp — the lesson that scene exists to teach.

import { useId, useMemo } from 'react';
import { WF } from '../theme';
import type { Scene, SceneKind } from '../exposure';
import type { Derived } from '../exposure';

export function ScenePlaceholder({
  scene,
  d,
  rounded = true,
}: {
  scene: Scene;
  d: Derived;
  rounded?: boolean;
}) {
  // Stable bokeh disc layout per scene (no per-render jitter).
  const discs = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        x: 12 + ((i * 37) % 78),
        y: 14 + ((i * 53) % 64),
        s: 0.6 + ((i * 17) % 9) / 10,
      })),
    [],
  );

  const showBokeh = d.bokehRadius > 7 && scene.dof >= 0.5;

  // Unique filter ids per instance so multiple placeholders on one page
  // (Hero + Simulator transition, say) don't share state.
  const fid = useId().replace(/[:]/g, '');
  const subjFilterId = `${fid}-subj`;
  const bgFilterId = `${fid}-bgm`;

  const subjAxis = d.motionAxis === 'h' ? `${d.subjectBlurPx} 0` : `0 ${d.subjectBlurPx}`;
  const bgAxis = d.motionAxis === 'h' ? `${d.bgMotionBlurPx} 0` : `0 ${d.bgMotionBlurPx}`;

  const useSubjMotion = d.subjectBlurPx > 0.4;
  const useBgMotion = d.bgMotionBlurPx > 0.4;

  const subjectFilter = useSubjMotion ? `url(#${subjFilterId})` : 'none';
  const bgPlaneFilter = [
    d.dofBlurPx > 0.2 ? `blur(${d.dofBlurPx}px)` : '',
    useBgMotion ? `url(#${bgFilterId})` : '',
  ]
    .filter(Boolean)
    .join(' ') || 'none';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        border: `1.6px solid ${WF.ink}`,
        borderRadius: rounded ? 6 : 0,
        background: WF.panel,
        overflow: 'hidden',
      }}
    >
      {/* Inline SVG filter defs — referenced from the HTML layers above
          via `filter: url(#id)`. Wide filter region so large stdDeviation
          doesn't clip at the element edges. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id={subjFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={subjAxis} />
          </filter>
          <filter id={bgFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={bgAxis} />
          </filter>
        </defs>
      </svg>

      {/* Exposure wrapper: brightness/contrast affects everything inside. */}
      <div style={{ position: 'absolute', inset: 0, filter: d.sceneFilter }}>
        {/* Background plane — depth of field + focal-length crop live here,
            plus any background motion streak (waterfall silk, pan blur). */}
        <div
          style={{
            position: 'absolute',
            inset: -40,
            transform: `scale(${d.fovScale})`,
            filter: bgPlaneFilter,
            transition: 'filter 0.18s linear, transform 0.18s linear',
          }}
        >
          {/* Universal hatched paper texture, dialled down so the per-scene
              art (now in colour) reads on top of it. */}
          <div className="wf-hatch" style={{ position: 'absolute', inset: 0, opacity: 0.32 }} />

          {/* Per-scene background composition. Drawn in viewBox 0..100 so
              it scales fluidly with the panel. */}
          <BackgroundArt kind={scene.kind} />

          {showBokeh &&
            discs.map((c, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  width: d.bokehRadius * 2 * c.s,
                  height: d.bokehRadius * 2 * c.s,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.55)',
                  filter: 'blur(1.5px)',
                }}
              />
            ))}
        </div>

        {/* Subject — stays comparatively sharp so wide-aperture DOF reads;
            picks up motion smear from a slow shutter on a moving scene
            (only when this scene's motion lives on the subject). */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '60%',
            transform: 'translate(-50%, -50%)',
            filter: subjectFilter,
            transition: 'filter 0.18s linear',
          }}
        >
          {d.subjectBlurPx > 6 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform:
                  d.motionAxis === 'h'
                    ? `translateX(${d.subjectBlurPx * 1.6}px)`
                    : `translateY(${d.subjectBlurPx * 1.6}px)`,
                opacity: 0.4,
              }}
            >
              <SubjectArt kind={scene.kind} />
            </div>
          )}
          <SubjectArt kind={scene.kind} />
        </div>
      </div>

      {/* Sensor grain — above the exposure wrapper so it doesn't get
          brightness-scaled away; opacity tracks ISO. */}
      {d.grainOpacity > 0.01 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: d.grainOpacity,
            background:
              'radial-gradient(rgba(0,0,0,0.7) 0.6px, transparent 1px)',
            backgroundSize: '3px 3px',
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Shadow crush — detail-eating darkness in the lower band. */}
      {d.clipLow && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '42%',
            background: 'linear-gradient(180deg, transparent, rgba(10,8,6,0.55))',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Caption + live readout. */}
      <div style={{ position: 'absolute', top: 10, left: 12, right: 12 }}>
        <div className="wf-tag">{scene.caption}</div>
        <div
          className="wf-mono"
          style={{
            fontSize: 11,
            marginTop: 3,
            color: d.clipHigh || d.clipLow ? WF.amber : WF.ink2,
          }}
        >
          {d.ev >= 0 ? '+' : ''}
          {d.ev.toFixed(1)} EV
          {d.clipHigh ? ' · ▲ highlights clipping' : ''}
          {d.clipLow ? ' · ▼ shadows crushed' : ''}
        </div>
      </div>
    </div>
  );
}

/* ─────────── per-scene composition ─────────── */

const INK = WF.ink;
const INK3 = WF.ink3 as unknown as string;

/* Per-scene illustration palette. Muted, slightly desaturated swatches so
   the colour reads as illustration-on-paper rather than photo-real — and
   so the exposure model's brightness/sepia/hue filters can still tint the
   image expressively without going lurid. Each scene's choices double as
   teaching cues: warm tungsten vs cool daylight in the café, deep blue
   silhouette + amber sun on the beach, red car against grey boulevard. */
const PAL = {
  'street-night': {
    sky: '#1f2a44',
    skyLow: '#2c3a5a',
    block: '#10182a',
    blockSoft: '#1b2540',
    window: '#f1c460',
    neonA: '#e34a7e',
    neonB: '#5fd0d8',
    lamp: '#f0a050',
    lampGlow: 'rgba(240,160,80,0.32)',
    street: '#0e131e',
  },
  waterfall: {
    sky: '#d8d6c2',
    cliff: '#8c7a5a',
    cliffShade: '#5e4f36',
    water: '#5d96a4',
    waterHi: '#bcd9da',
    pool: '#3f7079',
    rock: '#6b553a',
    moss: '#788a4a',
  },
  skater: {
    sky: '#f2c294',
    horizon: '#d49370',
    concrete: '#aea89c',
    concreteShade: '#7e776a',
    floor: '#c7bfae',
    sun: '#f4d870',
  },
  cafe: {
    wall: '#d99850',
    wallShade: '#a86a32',
    daylight: '#a4c1d8',
    daylightHi: '#d5e3ed',
    table: '#7a4e2e',
    pendant: '#f6d27a',
    pendantGlow: 'rgba(246,210,122,0.55)',
  },
  panning: {
    sky: '#ead8b4',
    skyLow: '#d6b478',
    building: '#5c6878',
    buildingHi: '#8893a3',
    road: '#776c5a',
    roadStripe: '#e7c66a',
    lamp: '#f0a050',
  },
  beach: {
    skyTop: '#f3b569',
    skyMid: '#e07b58',
    skyLow: '#c54e6e',
    sun: '#f7d04a',
    sunHalo: '#ef9a52',
    ocean: '#395280',
    oceanShine: '#c14a78',
    sand: '#caa478',
  },
} as const;

function BackgroundArt({ kind }: { kind: SceneKind }) {
  switch (kind) {
    case 'street-night': {
      const p = PAL['street-night'];
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden
        >
          {/* Night sky gradient */}
          <defs>
            <linearGradient id="sn-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.sky} />
              <stop offset="1" stopColor={p.skyLow} />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="84" fill="url(#sn-sky)" opacity="0.82" />
          <rect x="0" y="84" width="100" height="16" fill={p.street} opacity="0.78" />

          {/* Skyline silhouettes — coloured fills then ink outlines */}
          {[
            [0, 60, 10, 40],
            [10, 48, 8, 52],
            [18, 56, 7, 44],
            [25, 40, 12, 60],
            [37, 52, 9, 48],
            [46, 30, 11, 70],
            [57, 50, 8, 50],
            [65, 44, 10, 56],
            [75, 56, 9, 44],
            [84, 38, 7, 62],
            [91, 52, 9, 48],
          ].map(([x, y, w, h], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={i % 2 ? p.block : p.blockSoft}
              stroke={INK}
              strokeWidth="0.45"
              opacity="0.92"
            />
          ))}
          {/* Tiny lit windows — warm amber */}
          {[[5, 70], [15, 64], [29, 58], [41, 70], [49, 50], [60, 66], [70, 60], [78, 72], [86, 56], [93, 68]].map(
            ([x, y], i) => (
              <rect key={`w${i}`} x={x} y={y} width="1.2" height="1.4" fill={p.window} opacity="0.95" />
            ),
          )}
          {/* Neon sign — magenta slab with cyan inner line */}
          <rect x="44" y="36" width="14" height="3.2" fill={p.neonA} stroke={INK} strokeWidth="0.55" opacity="0.92" />
          <line x1="46" y1="37.6" x2="56" y2="37.6" stroke={p.neonB} strokeWidth="0.6" strokeDasharray="0.6 0.6" />
          {/* Street + curb */}
          <line x1="0" y1="84" x2="100" y2="84" stroke={INK} strokeWidth="0.6" />
          <line x1="0" y1="88" x2="100" y2="88" stroke={p.window} strokeWidth="0.5" strokeDasharray="3 4" opacity="0.75" />
          {/* Lamppost glows — warm amber pools */}
          {[18, 62, 88].map((x, i) => (
            <g key={`l${i}`}>
              <circle cx={x} cy="68" r="5.5" fill={p.lampGlow} />
              <line x1={x} y1="68" x2={x} y2="84" stroke={INK} strokeWidth="0.4" />
              <circle cx={x} cy="68" r="1.4" fill={p.lamp} />
              <circle cx={x} cy="68" r="3" fill="none" stroke={p.lamp} strokeWidth="0.3" opacity="0.6" />
            </g>
          ))}
        </svg>
      );
    }

    case 'waterfall': {
      const p = PAL.waterfall;
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden
        >
          {/* Sky behind the cliff */}
          <rect x="0" y="0" width="100" height="22" fill={p.sky} opacity="0.78" />
          {/* Cliff ledge */}
          <path d="M 0 18 Q 25 14 50 18 Q 75 22 100 18 L 100 22 L 0 22 Z" fill={p.cliff} opacity="0.85" />
          <line x1="0" y1="18" x2="100" y2="18" stroke={INK} strokeWidth="0.55" />
          {/* Water curtain */}
          <rect x="14" y="22" width="74" height="64" fill={p.water} opacity="0.72" />
          {/* Vertical flow streams — pale highlights */}
          {[18, 28, 36, 44, 52, 60, 68, 76, 84].map((x, i) => (
            <line
              key={i}
              x1={x + (i % 2 ? -0.4 : 0.4)}
              y1="22"
              x2={x}
              y2="86"
              stroke={p.waterHi}
              strokeWidth="0.7"
              opacity="0.82"
            />
          ))}
          {/* Pool at the base */}
          <rect x="0" y="86" width="100" height="14" fill={p.pool} opacity="0.82" />
          <line x1="0" y1="86" x2="100" y2="86" stroke={INK} strokeWidth="0.5" />
          <line x1="8" y1="90" x2="92" y2="90" stroke={p.waterHi} strokeWidth="0.4" strokeDasharray="2 3" opacity="0.7" />
          {/* Rocks — mossy brown */}
          <ellipse cx="18" cy="92" rx="8" ry="3.5" fill={p.rock} opacity="0.92" />
          <ellipse cx="18" cy="90.6" rx="6.5" ry="1.4" fill={p.moss} opacity="0.7" />
          <ellipse cx="80" cy="93" rx="10" ry="4" fill={p.rock} opacity="0.92" />
          <ellipse cx="80" cy="91.4" rx="8" ry="1.6" fill={p.moss} opacity="0.7" />
        </svg>
      );
    }

    case 'skater': {
      const p = PAL.skater;
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden
        >
          {/* Warm afternoon sky → dusty horizon */}
          <defs>
            <linearGradient id="sk-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.sky} />
              <stop offset="1" stopColor={p.horizon} />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="56" fill="url(#sk-sky)" opacity="0.85" />
          {/* Distant sun glow */}
          <circle cx="22" cy="22" r="6" fill={p.sun} opacity="0.7" />
          {/* Half-pipe interior wash (curved sides + floor) */}
          <path
            d="M 8 56 Q 8 92 30 92 L 70 92 Q 92 92 92 56 L 92 100 L 8 100 Z"
            fill={p.concrete}
            opacity="0.9"
          />
          <path
            d="M 30 92 L 70 92 L 70 100 L 30 100 Z"
            fill={p.floor}
            opacity="0.6"
          />
          {/* Distant horizon dashed line + light pole */}
          <line x1="0" y1="56" x2="100" y2="56" stroke={p.concreteShade} strokeWidth="0.5" strokeDasharray="2 3" />
          <line x1="86" y1="14" x2="86" y2="56" stroke={INK} strokeWidth="0.4" />
          <circle cx="86" cy="14" r="1.4" fill={p.sun} opacity="0.9" />
          {/* Half-pipe outlines (preserve sketch lines on top of fill) */}
          <path d="M 8 92 Q 8 56 30 56" fill="none" stroke={INK} strokeWidth="1" />
          <path d="M 92 92 Q 92 56 70 56" fill="none" stroke={INK} strokeWidth="1" />
          <line x1="30" y1="92" x2="70" y2="92" stroke={INK} strokeWidth="1" />
          <line x1="8" y1="92" x2="30" y2="92" stroke={INK} strokeWidth="1" />
          <line x1="70" y1="92" x2="92" y2="92" stroke={INK} strokeWidth="1" />
          {/* Coping (top edges) */}
          <line x1="8" y1="56" x2="30" y2="56" stroke={INK} strokeWidth="0.5" strokeDasharray="1 2" opacity="0.6" />
          <line x1="70" y1="56" x2="92" y2="56" stroke={INK} strokeWidth="0.5" strokeDasharray="1 2" opacity="0.6" />
          {/* Floor tiles */}
          <line x1="36" y1="92" x2="36" y2="96" stroke={p.concreteShade} strokeWidth="0.4" />
          <line x1="50" y1="92" x2="50" y2="96" stroke={p.concreteShade} strokeWidth="0.4" />
          <line x1="64" y1="92" x2="64" y2="96" stroke={p.concreteShade} strokeWidth="0.4" />
        </svg>
      );
    }

    case 'cafe': {
      const p = PAL.cafe;
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden
        >
          {/* Tungsten-warm interior wall surrounds a cool daylight window —
              the white-balance lesson made visible. */}
          <rect x="0" y="0" width="100" height="100" fill={p.wall} opacity="0.78" />
          {/* Window: cool blue daylight */}
          <rect x="10" y="14" width="80" height="60" fill={p.daylight} opacity="0.88" />
          <rect x="10" y="14" width="80" height="22" fill={p.daylightHi} opacity="0.55" />
          {/* Window frame */}
          <rect x="10" y="14" width="80" height="60" fill="none" stroke={INK} strokeWidth="0.8" />
          <line x1="50" y1="14" x2="50" y2="74" stroke={INK} strokeWidth="0.5" />
          <line x1="10" y1="44" x2="90" y2="44" stroke={INK} strokeWidth="0.5" />
          {/* Wall trim/shadow under window */}
          <rect x="0" y="74" width="100" height="8" fill={p.wallShade} opacity="0.6" />
          {/* Café table — warm wood */}
          <rect x="0" y="82" width="100" height="18" fill={p.table} opacity="0.85" />
          <line x1="22" y1="82" x2="78" y2="82" stroke={INK} strokeWidth="0.7" />
          <line x1="30" y1="82" x2="32" y2="100" stroke={INK} strokeWidth="0.4" />
          <line x1="68" y1="82" x2="70" y2="100" stroke={INK} strokeWidth="0.4" />
          {/* Pendant lamp top-center with warm glow */}
          <circle cx="50" cy="10" r="6" fill={p.pendantGlow} />
          <line x1="50" y1="14" x2="50" y2="6" stroke={INK} strokeWidth="0.4" />
          <ellipse cx="50" cy="10" rx="2.4" ry="1.2" fill={p.pendant} stroke={INK} strokeWidth="0.4" />
        </svg>
      );
    }

    case 'panning': {
      const p = PAL.panning;
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden
        >
          {/* Warm urban sky */}
          <defs>
            <linearGradient id="pn-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.sky} />
              <stop offset="1" stopColor={p.skyLow} />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="76" fill="url(#pn-sky)" opacity="0.86" />
          {/* Road */}
          <rect x="0" y="76" width="100" height="24" fill={p.road} opacity="0.86" />
          {/* Distant boulevard buildings — muted blue-grey */}
          {[
            [3, 38, 8, 36],
            [13, 30, 9, 44],
            [24, 42, 7, 32],
            [33, 28, 10, 46],
            [45, 36, 8, 38],
            [55, 30, 11, 44],
            [68, 38, 8, 36],
            [78, 32, 9, 42],
            [89, 40, 8, 34],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={i % 2 ? p.building : p.buildingHi}
                stroke={INK}
                strokeWidth="0.45"
                opacity="0.9"
              />
              {/* Window grid hints */}
              <line x1={x + w / 2} y1={y + 2} x2={x + w / 2} y2={y + h - 2} stroke={INK3} strokeWidth="0.3" strokeDasharray="0.6 0.8" />
            </g>
          ))}
          {/* Boulevard center line + curbs (these streak horizontally) */}
          <line x1="0" y1="76" x2="100" y2="76" stroke={INK} strokeWidth="0.5" />
          <line x1="0" y1="86" x2="100" y2="86" stroke={INK} strokeWidth="0.5" />
          {[6, 22, 38, 54, 70, 86].map((x, i) => (
            <line key={`s${i}`} x1={x} y1="81" x2={x + 8} y2="81" stroke={p.roadStripe} strokeWidth="1" />
          ))}
          {/* Lampposts repeating along the boulevard */}
          {[12, 36, 60, 84].map((x, i) => (
            <g key={`p${i}`}>
              <line x1={x} y1="62" x2={x} y2="76" stroke={INK} strokeWidth="0.4" />
              <circle cx={x} cy="62" r="1.1" fill={p.lamp} />
            </g>
          ))}
        </svg>
      );
    }

    case 'beach': {
      const p = PAL.beach;
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
          aria-hidden
        >
          {/* Sunset sky gradient — the highlight lesson lives here */}
          <defs>
            <linearGradient id="bh-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.skyTop} />
              <stop offset="0.55" stopColor={p.skyMid} />
              <stop offset="1" stopColor={p.skyLow} />
            </linearGradient>
            <linearGradient id="bh-sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.ocean} />
              <stop offset="1" stopColor="#22325a" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="60" fill="url(#bh-sky)" opacity="0.92" />
          {/* Sun halo + disc */}
          <circle cx="50" cy="52" r="14" fill={p.sunHalo} opacity="0.55" />
          <circle cx="50" cy="52" r="9" fill={p.sun} stroke={INK} strokeWidth="0.7" />
          {/* Faint thin horizontal lines for that hand-drawn sky */}
          {[10, 16, 22, 28, 34, 40].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="100" y2={y} stroke={INK3} strokeWidth="0.3" opacity={0.4 - i * 0.04} />
          ))}
          {/* Horizon */}
          <line x1="0" y1="60" x2="100" y2="60" stroke={INK} strokeWidth="0.6" />
          {/* Ocean */}
          <rect x="0" y="60" width="100" height="26" fill="url(#bh-sea)" opacity="0.92" />
          {/* Sun reflection on water — magenta shimmer */}
          <ellipse cx="50" cy="62" rx="14" ry="1.2" fill={p.oceanShine} opacity="0.85" />
          <ellipse cx="50" cy="66" rx="10" ry="0.8" fill={p.oceanShine} opacity="0.6" />
          <ellipse cx="50" cy="70" rx="7" ry="0.6" fill={p.oceanShine} opacity="0.4" />
          {/* Ocean ripple lines */}
          {[64, 68, 72, 76].map((y, i) => (
            <line
              key={`o${i}`}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke={p.sunHalo}
              strokeWidth="0.4"
              strokeDasharray="6 3"
              opacity={0.5 - i * 0.08}
            />
          ))}
          {/* Sand */}
          <rect x="0" y="86" width="100" height="14" fill={p.sand} opacity="0.92" />
          {[
            'M 0 88 Q 25 86 50 88 T 100 88',
            'M 0 93 Q 25 91 50 93 T 100 93',
            'M 0 98 Q 25 96 50 98 T 100 98',
          ].map((d, i) => (
            <path key={`s${i}`} d={d} fill="none" stroke={INK} strokeWidth="0.35" opacity="0.45" />
          ))}
        </svg>
      );
    }
  }
}

function SubjectArt({ kind }: { kind: SceneKind }) {
  switch (kind) {
    case 'street-night':
      // Pedestrian with a long coat — deep maroon, warm skin
      return (
        <svg width="120" height="180" viewBox="0 0 120 180" aria-hidden>
          {/* Coat fill */}
          <path
            d="M 30 168 L 36 70 Q 60 50 84 70 L 90 168 Z"
            fill="#5a2632"
            stroke={INK}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Coat collar V */}
          <path d="M 52 62 L 60 80 L 68 62" fill="#3a1820" stroke={INK} strokeWidth="1" />
          {/* Head */}
          <ellipse cx="60" cy="38" rx="14" ry="16" fill="#d9a578" stroke={INK} strokeWidth="1.4" />
          {/* Brim hat */}
          <path d="M 38 28 L 82 28" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="60" cy="22" rx="11" ry="6" fill="#2a1f1a" stroke={INK} strokeWidth="1.2" />
        </svg>
      );

    case 'waterfall':
      // Mossy foreground rock — stays sharp while water streaks behind
      return (
        <svg width="120" height="100" viewBox="0 0 120 100" aria-hidden>
          <path
            d="M 10 90 Q 18 50 40 56 Q 60 40 80 60 Q 100 52 110 90 Z"
            fill="#6b553a"
            stroke={INK}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Moss highlights */}
          <path
            d="M 22 62 Q 36 54 50 60 Q 66 50 84 62"
            fill="none"
            stroke="#788a4a"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      );

    case 'skater':
      // Skater mid-trick — bright red shirt pops as the "frozen" subject
      return (
        <svg width="120" height="160" viewBox="0 0 120 160" aria-hidden>
          {/* Head */}
          <circle cx="62" cy="34" r="11" fill="#e2b58a" stroke={INK} strokeWidth="1.4" />
          {/* Helmet */}
          <path d="M 51 32 Q 62 18 73 32 Z" fill="#2a4358" stroke={INK} strokeWidth="1.2" />
          {/* Torso (red shirt) */}
          <path
            d="M 56 46 Q 50 70 46 96 L 56 102 Q 64 78 70 50 Z"
            fill="#d44430"
            stroke={INK}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Arms */}
          <path d="M 56 60 Q 30 50 18 30" fill="none" stroke="#d44430" strokeWidth="3" strokeLinecap="round" />
          <path d="M 56 60 Q 30 50 18 30" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M 64 56 Q 88 56 102 78" fill="none" stroke="#d44430" strokeWidth="3" strokeLinecap="round" />
          <path d="M 64 56 Q 88 56 102 78" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
          {/* Legs (dark jeans) */}
          <path d="M 50 100 L 28 130" fill="none" stroke="#1f2a44" strokeWidth="4" strokeLinecap="round" />
          <path d="M 50 100 L 28 130" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M 54 100 L 78 132" fill="none" stroke="#1f2a44" strokeWidth="4" strokeLinecap="round" />
          <path d="M 54 100 L 78 132" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
          {/* Board */}
          <path d="M 18 138 Q 50 130 90 140 L 92 144 Q 50 134 18 142 Z" fill="#3a2820" stroke={INK} strokeWidth="1" />
          {/* Wheels */}
          <circle cx="28" cy="148" r="3.5" fill="#f4d870" stroke={INK} strokeWidth="1.2" />
          <circle cx="80" cy="150" r="3.5" fill="#f4d870" stroke={INK} strokeWidth="1.2" />
        </svg>
      );

    case 'cafe':
      // Seated figure — teal sweater, warm skin, amber mug. The portrait
      // colour story sells "shallow DOF separates the subject".
      return (
        <svg width="140" height="200" viewBox="0 0 140 200" aria-hidden>
          {/* Sweater */}
          <path
            d="M 30 188 Q 30 110 70 100 Q 110 110 110 188"
            fill="#3e7480"
            stroke={INK}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {/* Neckline */}
          <path d="M 56 102 Q 70 112 84 102" fill="#2a5460" stroke={INK} strokeWidth="1.2" />
          {/* Head */}
          <ellipse cx="70" cy="46" rx="22" ry="24" fill="#e2b58a" stroke={INK} strokeWidth="1.6" />
          {/* Hair */}
          <path d="M 48 38 Q 70 18 92 38 Q 90 26 70 22 Q 50 26 48 38 Z" fill="#4a2e1c" stroke={INK} strokeWidth="1.2" />
          {/* Arm holding a mug */}
          <path d="M 96 150 Q 110 140 118 156" fill="none" stroke="#3e7480" strokeWidth="4" strokeLinecap="round" />
          <path d="M 96 150 Q 110 140 118 156" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
          {/* Mug — warm amber, lit by tungsten */}
          <rect x="108" y="148" width="14" height="14" rx="2" fill="#d99840" stroke={INK} strokeWidth="1.3" />
          <path d="M 122 152 Q 128 154 126 160 Q 124 160 122 158" fill="none" stroke={INK} strokeWidth="1" />
          {/* Steam */}
          <path d="M 112 142 Q 110 138 113 134 Q 116 130 113 126" fill="none" stroke={INK3} strokeWidth="0.8" />
          <path d="M 118 142 Q 116 138 119 134 Q 122 130 119 126" fill="none" stroke={INK3} strokeWidth="0.8" />
        </svg>
      );

    case 'panning':
      // Bright red car — the "stays sharp" subject reads vividly against
      // the streaking grey boulevard.
      return (
        <svg width="160" height="80" viewBox="0 0 160 80" aria-hidden>
          {/* Body */}
          <path
            d="M 10 58 L 22 38 Q 40 28 80 26 Q 120 28 138 38 L 150 58 L 150 64 L 10 64 Z"
            fill="#d12f3a"
            stroke={INK}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Body shadow under the doorline */}
          <path
            d="M 10 58 L 150 58 L 150 64 L 10 64 Z"
            fill="#8a1c24"
            opacity="0.65"
          />
          {/* Windows — pale cool glass */}
          <path d="M 30 38 Q 50 32 80 30 L 78 50 L 36 50 Z" fill="#cdd6df" stroke={INK} strokeWidth="0.6" />
          <path d="M 86 30 Q 116 32 134 38 L 128 50 L 86 50 Z" fill="#cdd6df" stroke={INK} strokeWidth="0.6" />
          {/* Door line */}
          <line x1="80" y1="38" x2="80" y2="64" stroke={INK} strokeWidth="0.7" />
          {/* Wheels */}
          <circle cx="38" cy="66" r="8" fill="#1a1410" stroke={INK} strokeWidth="1.4" />
          <circle cx="122" cy="66" r="8" fill="#1a1410" stroke={INK} strokeWidth="1.4" />
          <circle cx="38" cy="66" r="3" fill="#aea89c" />
          <circle cx="122" cy="66" r="3" fill="#aea89c" />
          {/* Headlight — warm amber */}
          <circle cx="146" cy="50" r="2.4" fill="#f4d870" stroke={INK} strokeWidth="0.6" />
        </svg>
      );

    case 'beach':
      // Standing silhouette at the waterline — dark figure against the
      // bright sunset sells the highlights / silhouette lesson.
      return (
        <svg width="80" height="180" viewBox="0 0 80 180" aria-hidden>
          {/* Head */}
          <circle cx="40" cy="30" r="8" fill="#1a1410" />
          {/* Body — narrow silhouette */}
          <path d="M 32 38 Q 40 64 36 110 L 32 160 L 48 160 L 44 110 Q 40 64 48 38 Z" fill="#1a1410" />
          {/* Subtle reflection: dashed mirror beneath */}
          <path d="M 32 160 Q 40 168 48 160" fill="none" stroke="#c14a78" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
          <ellipse cx="40" cy="170" rx="14" ry="3" fill="#1a1410" opacity="0.35" />
        </svg>
      );
  }
}

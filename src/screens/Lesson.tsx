// Guided Lessons — three scripted walkthroughs that turn the dials
// you met in the Simulator into intent. Each lesson pins a scene,
// starts you at the *wrong* settings on purpose, and detects when
// you've made the move it's teaching.

import { useEffect, useMemo, useState } from 'react';
import { AppChrome, type View } from '../components/AppChrome';
import { Dial } from '../components/Dial';
import { Histogram } from '../components/Histogram';
import { ScenePlaceholder } from '../components/ScenePlaceholder';
import {
  SCENES,
  formatAperture,
  formatShutter,
  type Scene,
  type Settings,
} from '../exposure';
import { LADDERS, useExposure } from '../useExposure';
import { WF } from '../theme';

interface LessonDef {
  n: number;
  title: string;
  kicker: string;
  sceneKind: Scene['kind'];
  /** Patch applied to the scene defaults so the user starts "wrong" on purpose. */
  start: Partial<Settings>;
  steps: { text: string; hint?: string }[];
  successText: string;
}

const LESSONS: LessonDef[] = [
  {
    n: 1,
    title: 'Freeze the skater',
    kicker: 'shutter · stop the action',
    sceneKind: 'skater',
    start: { shutter: 1 / 30, aperture: 11, iso: 400 }, // dim AND smeared
    steps: [
      { text: 'See the smear? At 1/30s the skater drags across the frame.' },
      {
        text: 'Speed the shutter up. Drag the SHUTTER dial up until the skater is sharp.',
        hint: 'Aim for 1/500s or faster.',
      },
      {
        text: 'Now compensate — the faster shutter ate light. Open the aperture or raise ISO until the EV is near 0.',
      },
    ],
    successText:
      'Frozen — that crisp skater is your shutter speed translating motion into time.',
  },
  {
    n: 2,
    title: 'Silk a waterfall',
    kicker: 'shutter · time becomes texture',
    sceneKind: 'waterfall',
    start: { shutter: 1 / 250, ndIndex: 0, aperture: 11, iso: 100 },
    steps: [
      { text: 'A 1/250s shot of falling water just looks ordinary — frozen droplets.' },
      {
        text: 'Slow the shutter way down. Drag SHUTTER until the water silks into a wash.',
        hint: 'Try 1/4s or longer.',
      },
      {
        text: 'Too bright now? Add an ND filter or close the aperture until EV returns to 0.',
      },
    ],
    successText:
      'Silky — a long exposure averages the water’s motion into a continuous wash.',
  },
  {
    n: 3,
    title: 'Isolate the subject',
    kicker: 'aperture + focal · the portrait look',
    sceneKind: 'cafe',
    start: { aperture: 11, focal: 35, iso: 800, shutter: 1 / 125 },
    steps: [
      { text: 'At f/11 and 35mm, the subject competes with the background — everything is in focus.' },
      {
        text: 'Open the aperture — drag APERTURE up — to throw the background out of focus.',
        hint: 'Aim for f/2 or wider.',
      },
      {
        text: 'Now zoom in: switch the FOCAL dial to 85mm. A longer lens compresses and blurs the background even more.',
      },
    ],
    successText:
      'That’s the portrait look — wide aperture *and* long focal length isolate the subject.',
  },
  {
    n: 4,
    title: 'Low-light reality',
    kicker: 'ISO · the noise tax',
    sceneKind: 'street-night',
    start: { iso: 100, shutter: 1 / 1000, aperture: 2.8, ndIndex: 0 },
    steps: [
      { text: 'At ISO 100 and 1/1000s, the night street is a black rectangle. There simply isn’t enough light.' },
      {
        text: 'Raise the ISO. Watch the scene appear — and watch the grain build with every stop.',
        hint: 'Each step doubles the amplification (and the noise).',
      },
      {
        text: 'Slow the shutter too. A 1/60s shot at ISO 1600 looks cleaner than a 1/1000s shot at ISO 12800. Cleaner shadows beat faster exposure when the subject permits.',
      },
    ],
    successText:
      'That’s the ISO tax — every doubling of sensitivity doubles the noise floor. Keep it as low as the light lets you.',
  },
  {
    n: 5,
    title: 'Master the pan',
    kicker: 'shutter · subject sharp, world streaks',
    sceneKind: 'panning',
    start: { shutter: 1 / 1000, aperture: 8, iso: 200, ndIndex: 0 },
    steps: [
      { text: 'At 1/1000s, the boulevard is frozen — sharp but lifeless. The panning shot is supposed to *streak*.' },
      {
        text: 'Drop the SHUTTER to about 1/30s. Watch the background blur into horizontal streaks while the subject stays sharp.',
        hint: 'In real life you’d swing the camera with the subject so it stays still on the sensor; here we simulate that for you.',
      },
      {
        text: 'Now balance the new exposure. The slower shutter doubled the light — close the aperture, drop the ISO, or add an ND filter to bring EV back to 0.',
      },
    ],
    successText:
      'That streak is your shutter speed *and* your shoulders — slow exposure plus motion-locked tracking is how panning works.',
  },
  {
    n: 6,
    title: 'Protect the highlights',
    kicker: 'histogram · the right wall',
    sceneKind: 'beach',
    start: { aperture: 4, shutter: 1 / 60, iso: 100, ndIndex: 0 },
    steps: [
      { text: 'Highlights are blown — see the amber zebra wash and the histogram pinned against the right wall? That detail is gone forever.' },
      {
        text: 'Stop down or speed up the shutter until the zebras disappear and the right-wall clipping flag clears.',
        hint: 'A faster shutter halves the light each stop, just like a smaller aperture.',
      },
      {
        text: 'Bonus: dial in about −0.5 EV. Slight underexposure on a sunset protects the drama in the sky.',
      },
    ],
    successText:
      'Highlight discipline — once you can read the histogram’s right wall, you’ll never blow a sky again.',
  },
];

const TOTAL = LESSONS.length;

const numberFromHash = (): number => {
  const m = window.location.hash.match(/#\/lesson\/(\d+)/);
  if (!m) return 1;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= TOTAL ? n : 1;
};

export function Lesson({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [n, setN] = useState<number>(numberFromHash);

  useEffect(() => {
    const onHash = () => setN(numberFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const lesson = LESSONS[n - 1];
  const scene = useMemo(
    () => SCENES.find((s) => s.kind === lesson.sceneKind) as Scene,
    [lesson],
  );

  const { settings, idx, set, d } = useExposure(scene);

  // Apply the lesson's "wrong on purpose" starting state once per lesson.
  useEffect(() => {
    if (lesson.start.iso) set.iso(nearest(LADDERS.iso, lesson.start.iso));
    if (lesson.start.shutter) set.shutter(nearest(LADDERS.shutter, lesson.start.shutter));
    if (lesson.start.aperture) set.aperture(nearest(LADDERS.aperture, lesson.start.aperture));
    if (lesson.start.focal) set.focal(nearest(LADDERS.focal, lesson.start.focal));
    if (typeof lesson.start.ndIndex === 'number') set.nd(lesson.start.ndIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  // Step advancement: walk through the steps as the user makes progress.
  const passedTarget = useMemo(() => evaluateLesson(lesson, settings, d.ev), [lesson, settings, d.ev]);

  const goPrev = () => {
    const prev = Math.max(1, n - 1);
    window.location.hash = `#/lesson/${prev}`;
  };
  const goNext = () => {
    const next = Math.min(TOTAL, n + 1);
    window.location.hash = `#/lesson/${next}`;
  };
  const restart = () => {
    if (lesson.start.iso) set.iso(nearest(LADDERS.iso, lesson.start.iso));
    if (lesson.start.shutter) set.shutter(nearest(LADDERS.shutter, lesson.start.shutter));
    if (lesson.start.aperture) set.aperture(nearest(LADDERS.aperture, lesson.start.aperture));
    if (lesson.start.focal) set.focal(nearest(LADDERS.focal, lesson.start.focal));
    if (typeof lesson.start.ndIndex === 'number') set.nd(lesson.start.ndIndex);
  };

  const nd = LADDERS.nd[settings.ndIndex];

  return (
    <div className="wf-art">
      <AppChrome active="LESSONS" onNavigate={onNavigate} />

      {/* Lesson rail (left) */}
      <div
        style={{
          position: 'absolute',
          top: 78,
          left: 24,
          bottom: 24,
          width: 320,
          padding: 18,
          background: 'rgba(231,227,218,0.92)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 10,
          overflowY: 'auto',
        }}
      >
        <div className="wf-tag" style={{ marginBottom: 4 }}>
          LESSON {n} OF {TOTAL}
        </div>
        <h2 className="wf-hand" style={{ fontSize: 36, lineHeight: 1, margin: '4px 0 4px' }}>
          {lesson.title}
        </h2>
        <div className="wf-tag" style={{ marginBottom: 14, color: WF.ink2 }}>{lesson.kicker}</div>

        <ol style={{ paddingLeft: 18, margin: 0 }}>
          {lesson.steps.map((step, i) => (
            <li
              key={i}
              style={{
                marginBottom: 14,
                lineHeight: 1.35,
                color: WF.ink,
                fontSize: 14,
              }}
            >
              <div>{step.text}</div>
              {step.hint && (
                <div className="wf-anno" style={{ fontSize: 14, marginTop: 4 }}>
                  ↳ {step.hint}
                </div>
              )}
            </li>
          ))}
        </ol>

        {passedTarget && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              background: WF.amberSoft,
              border: `1.4px solid ${WF.amber}`,
              borderRadius: 8,
            }}
          >
            <div className="wf-tag" style={{ color: WF.amber, marginBottom: 4 }}>
              ✓ YOU GOT IT
            </div>
            <p className="wf-note" style={{ fontSize: 14, margin: 0, color: WF.ink }}>
              {lesson.successText}
            </p>
          </div>
        )}

        <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="wf-pill" type="button" onClick={goPrev} disabled={n === 1}>
            ← prev
          </button>
          <button className="wf-pill" type="button" onClick={restart}>
            restart
          </button>
          <button
            className={`wf-pill${passedTarget ? ' wf-active' : ''}`}
            type="button"
            onClick={goNext}
            disabled={n === TOTAL}
          >
            next →
          </button>
        </div>
      </div>

      {/* Scene (right of rail) */}
      <div style={{ position: 'absolute', top: 78, left: 360, right: 24, bottom: 230 }}>
        <ScenePlaceholder scene={scene} d={d} />
      </div>

      {/* Compact dial deck under the scene */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 360,
          right: 24,
          padding: '14px 16px',
          background: 'rgba(231,227,218,0.92)',
          border: `1.4px solid ${WF.ink}`,
          borderRadius: 10,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            className="wf-mono"
            style={{ fontSize: 22, color: d.clipHigh || d.clipLow ? WF.amber : WF.ink }}
          >
            {d.ev >= 0 ? '+' : ''}
            {d.ev.toFixed(1)} EV
          </div>
          <Histogram w={150} h={42} ev={d.ev} grain={d.grainOpacity} clipHigh={d.clipHigh} clipLow={d.clipLow} label="LESSON HIST" />
        </div>
        <div style={{ display: 'flex', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
          <Dial label="ISO" valueText={String(settings.iso)} index={idx.iso} count={LADDERS.iso.length} onChange={set.iso} size={84} />
          <Dial label="SHUTTER" valueText={formatShutter(settings.shutter)} index={idx.shutter} count={LADDERS.shutter.length} onChange={set.shutter} size={84} />
          <Dial label="APERTURE" valueText={formatAperture(settings.aperture)} index={idx.aperture} count={LADDERS.aperture.length} onChange={set.aperture} size={84} />
          <Dial label="FOCAL" valueText={`${settings.focal}mm`} index={idx.focal} count={LADDERS.focal.length} onChange={set.focal} size={84} />
          <Dial label="ND" valueText={nd.label} index={idx.nd} count={LADDERS.nd.length} onChange={set.nd} size={84} />
        </div>
      </div>
    </div>
  );
}

function nearest(arr: readonly number[], v: number): number {
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

// Per-lesson success check evaluated against the *real* exposure-aware EV
// (the lesson's `success` predicate only cares about the dialled values;
// here we additionally require the final exposure to be near-correct).
function evaluateLesson(lesson: LessonDef, s: Settings, ev: number): boolean {
  switch (lesson.n) {
    case 1: return s.shutter <= 1 / 500 + 1e-6 && Math.abs(ev) < 0.6;
    case 2: return s.shutter >= 1 / 4 - 1e-6 && Math.abs(ev) < 0.7;
    case 3: return s.aperture <= 2.0 + 1e-6 && s.focal >= 85 && Math.abs(ev) < 1.1;
    case 4: return s.iso >= 800 && s.iso <= 6400 && Math.abs(ev) < 0.7;
    case 5: return s.shutter >= 1 / 30 - 1e-6 && Math.abs(ev) < 0.7;
    case 6: return ev <= -0.3 && ev >= -1.0;
    default: return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Exposure model.
//
// This is the pedagogical core of the app: it turns a set of camera
// settings + a scene into the visual consequences a photographer would
// actually see. The math is the real exposure triangle (stops are
// log2 ratios of light); the mapping to screen effects is tuned for
// teaching clarity, not radiometric accuracy.
// ─────────────────────────────────────────────────────────────

const log2 = (x: number) => Math.log(x) / Math.LN2;
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

/* ---- Value ladders (each step ≈ one photographic stop) ---- */

export const ISO_VALUES = [100, 200, 400, 800, 1600, 3200, 6400, 12800];

// Shutter stored in seconds, slowest → fastest is awkward; keep
// fast → slow so dragging the dial "up" opens the shutter (more light).
export const SHUTTER_VALUES = [
  1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30,
  1 / 15, 1 / 8, 1 / 4, 1 / 2, 1,
];

export const APERTURE_VALUES = [1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

export const FOCAL_VALUES = [11, 24, 35, 50, 85, 135, 200];

export const ND_VALUES = [
  { label: 'none', stops: 0 },
  { label: 'ND2', stops: 1 },
  { label: 'ND8', stops: 3 },
  { label: 'ND64', stops: 6 },
  { label: 'ND1000', stops: 10 },
] as const;

// White-balance ladder in Kelvin — common camera presets.
// Lower K = warmer light (tungsten / candle), higher K = cooler (shade).
export const WB_VALUES = [2700, 3200, 4000, 5500, 6500, 7500, 8500];

export type SceneKind =
  | 'street-night'
  | 'waterfall'
  | 'skater'
  | 'cafe'
  | 'panning'
  | 'beach';

export interface Scene {
  kind: SceneKind;
  name: string;
  /** Monospace placeholder caption, mirrors the wireframe ScenePlaceholder. */
  caption: string;
  /** One-line teaching focus shown in the picker. */
  focus: string;
  /** The "correct" exposure for this scene (yields ~0 EV). */
  target: { iso: number; shutter: number; aperture: number };
  /** 0..1 — how much movement is in the frame (drives motion-blur teaching). */
  motion: number;
  /** 0..1 — how strongly background separation reads (drives DOF teaching). */
  dof: number;
  /** Direction the motion smears in. Waterfall = vertical, everything else
   *  in this MVP smears horizontally. */
  motionAxis: 'h' | 'v';
  /** Which plane the motion lives on. `subject` — a moving subject smears
   *  on a slow shutter (skater). `background` — the background streaks while
   *  the subject stays sharp (waterfall, panning). */
  motionTarget: 'subject' | 'background';
  /** Actual colour temperature of the light in this scene, in Kelvin.
   *  Setting the camera's WB to this neutralises the cast; mismatching it
   *  tints the image warm (WB > target) or cool (WB < target). */
  wbTarget: number;
}

export const SCENES: Scene[] = [
  {
    kind: 'street-night',
    name: 'Neon Street',
    caption: 'NIGHT STREET · neon, traffic, low-light',
    focus: 'low light · ISO',
    target: { iso: 1600, shutter: 1 / 60, aperture: 2.8 },
    motion: 0.5,
    dof: 0.45,
    motionAxis: 'h',
    motionTarget: 'subject',
    wbTarget: 4000, // mixed neon / sodium / tungsten — cool-leaning
  },
  {
    kind: 'waterfall',
    name: 'Cascade',
    caption: 'WATERFALL · long exposure, ND',
    focus: 'long exposure · ND',
    target: { iso: 100, shutter: 1 / 4, aperture: 11 },
    motion: 0.95,
    dof: 0.2,
    motionAxis: 'v',
    motionTarget: 'background',
    wbTarget: 5500, // daylight
  },
  {
    kind: 'skater',
    name: 'Skatepark',
    caption: 'SKATEBOARDER · freeze motion',
    focus: 'freeze · fast shutter',
    target: { iso: 400, shutter: 1 / 1000, aperture: 4 },
    motion: 0.9,
    dof: 0.4,
    motionAxis: 'h',
    motionTarget: 'subject',
    wbTarget: 5500, // outdoor daylight
  },
  {
    kind: 'cafe',
    name: 'Café Window',
    caption: 'CAFÉ PORTRAIT · shallow DOF',
    focus: 'shallow DOF · aperture',
    target: { iso: 800, shutter: 1 / 125, aperture: 1.8 },
    motion: 0.15,
    dof: 0.95,
    motionAxis: 'h',
    motionTarget: 'subject',
    wbTarget: 3200, // tungsten interior — needs warm WB to neutralise
  },
  {
    kind: 'panning',
    name: 'Boulevard Pan',
    caption: 'CITY PANNING · subject sharp, bg streaks',
    focus: 'panning · 1/30s',
    target: { iso: 200, shutter: 1 / 30, aperture: 8 },
    motion: 0.85,
    dof: 0.35,
    motionAxis: 'h',
    motionTarget: 'background',
    wbTarget: 5500, // urban daylight
  },
  {
    kind: 'beach',
    name: 'Beach Sunset',
    caption: 'BEACH SUNSET · highlights, silhouette',
    focus: 'highlights · −1 EV',
    target: { iso: 100, shutter: 1 / 250, aperture: 8 },
    motion: 0.25,
    dof: 0.4,
    motionAxis: 'h',
    motionTarget: 'subject',
    wbTarget: 6500, // overcast / golden-hour sky toward cooler shadows
  },
];

export interface Settings {
  iso: number;
  shutter: number; // seconds
  aperture: number; // f-number
  focal: number; // mm
  ndIndex: number; // index into ND_VALUES
  wb: number; // white balance, Kelvin
}

/** A scene's correct exposure → the starting point when you enter it. */
export function defaultSettings(scene: Scene): Settings {
  return {
    iso: scene.target.iso,
    shutter: scene.target.shutter,
    aperture: scene.target.aperture,
    focal: 50,
    ndIndex: 0,
    wb: scene.wbTarget,
  };
}

/** Format shutter seconds the way a camera would (1/250, 0.5", 1"). */
export function formatShutter(s: number): string {
  if (s >= 1) return `${s}"`;
  return `1/${Math.round(1 / s)}`;
}

export function formatAperture(f: number): string {
  return `f/${f}`;
}

/**
 * Exposure offset in stops vs. the scene's correct exposure.
 * Positive = brighter than ideal, negative = darker.
 *
 *   light ∝ shutter · ISO / aperture²
 */
export function evOffset(s: Settings, scene: Scene): number {
  const t = scene.target;
  const shutterStops = log2(s.shutter / t.shutter);
  const isoStops = log2(s.iso / t.iso);
  const apertureStops = 2 * log2(t.aperture / s.aperture);
  const ndStops = -ND_VALUES[s.ndIndex].stops;
  return shutterStops + isoStops + apertureStops + ndStops;
}

export interface Derived {
  ev: number;
  /** CSS filter string applied to the scene image layer. */
  sceneFilter: string;
  /** Overall motion-blur magnitude — `max(subject, background)`. Kept for
   *  back-compatible callers; renderers should prefer the split fields. */
  motionBlurPx: number;
  /** Motion smear applied to the subject (skater on a slow shutter). */
  subjectBlurPx: number;
  /** Motion streak applied to the background (waterfall silk, panning streaks). */
  bgMotionBlurPx: number;
  /** Axis the motion streaks along. */
  motionAxis: 'h' | 'v';
  /** Background blur in px — shallow depth of field. */
  dofBlurPx: number;
  /** Bokeh highlight disc radius in px (wide aperture → big, soft discs). */
  bokehRadius: number;
  /** Sensor-grain overlay opacity (0..0.55), grows with ISO. */
  grainOpacity: number;
  /** Field-of-view zoom from focal length (1 = 50mm reference). */
  fovScale: number;
  /** Signed Kelvin offset of camera WB vs the scene's actual light. + = warm tint. */
  wbTintK: number;
  clipHigh: boolean;
  clipLow: boolean;
  /** Short, interaction-first explanation of the dominant effect. */
  note: string;
}

export function derive(s: Settings, scene: Scene): Derived {
  const ev = evOffset(s, scene);

  // Brightness: closer to the true 2^EV response (one stop = double the
  // light) but tone-mapped with a soft highlight shoulder so the image
  // genuinely rolls toward white as it clips — like a sensor's shoulder —
  // instead of the old over-compressed curve that flagged clipping the
  // photo never showed.
  let lin = Math.pow(2, ev * 0.62);
  if (lin > 1) lin = 1 + (lin - 1) / (1 + (lin - 1) * 0.42); // highlight knee
  const brightness = clamp(lin, 0.1, 3.0);
  const contrast = clamp(1 + ev * 0.045, 0.82, 1.18);

  // White-balance tint. The camera's WB setting tells it "what colour is
  // white." If you tell it warmer than the light actually is (W > L),
  // the camera under-compensates the warm cast and the image goes warm;
  // colder (W < L) and it over-compensates into a cool cast.
  const wbTintK = s.wb - scene.wbTarget;
  const tNorm = clamp(wbTintK / 3000, -1, 1);
  const tintAmt = Math.abs(tNorm) * 0.55;
  const tintFilter =
    tintAmt > 0.012
      ? ` sepia(${tintAmt.toFixed(3)}) hue-rotate(${(tNorm > 0 ? -8 : 188).toFixed(0)}deg) saturate(${(1 + Math.abs(tNorm) * 0.25).toFixed(3)})`
      : '';

  const sceneFilter = `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)})${tintFilter}`;

  // Motion blur ∝ exposure time × subject speed (physically linear in
  // time). 1/500s ≈ frozen; longer shutters smear hard. Displayed through
  // a sqrt so a waterfall at 1/4s reads dramatically silkier than at
  // 1/1000s without running off the artboard. The same raw magnitude is
  // routed to the subject *or* the background depending on the scene —
  // waterfalls smear water (background, vertical), pans streak the
  // background (subject sharp), skaters smear themselves.
  const timeRatio = s.shutter * 500; // 1.0 at the 1/500s freeze reference
  const rawMotionPx = clamp(
    scene.motion * Math.sqrt(Math.max(0, timeRatio - 1)) * 2.3,
    0,
    28,
  );
  const subjectBlurPx = +(scene.motionTarget === 'subject' ? rawMotionPx : 0).toFixed(2);
  const bgMotionBlurPx = +(scene.motionTarget === 'background' ? rawMotionPx : 0).toFixed(2);
  const motionBlurPx = Math.max(subjectBlurPx, bgMotionBlurPx);

  // Depth of field: background blur grows as the aperture opens AND as
  // focal length increases — the portrait-lens lesson. f/11 ≈ reference
  // (deep), so f/16–f/22 still tighten and f/8 keeps a little separation.
  const apertureOpen = clamp(2 * log2(11 / s.aperture), 0, 7);
  const focalFactor = clamp(s.focal / 50, 0.35, 3.2); // 24mm≈0.5, 85mm≈1.7
  const dofStrength = scene.dof * apertureOpen * (0.45 + 0.55 * focalFactor);
  const dofBlurPx = +clamp(dofStrength * 1.7, 0, 16).toFixed(2);
  const bokehRadius = +clamp(dofStrength * 2.6 + 3, 3, 24).toFixed(2);

  // ISO noise — and noise also lives in lifted shadows: underexposing
  // then raising the image reveals grain ("expose to the right").
  const isoStops = clamp(log2(s.iso / 100), 0, 7);
  const shadowLift = clamp(-ev, 0, 4) * 0.6;
  const grainOpacity = +clamp((isoStops + shadowLift) * 0.05, 0, 0.6).toFixed(3);

  // Focal length → magnification / framing (telephoto ≈ ∝ focal length).
  const fovScale = +clamp(s.focal / 50, 0.55, 2.2).toFixed(3);

  // Clip thresholds aligned to where the new curve actually saturates.
  const clipHigh = ev > 1.8;
  const clipLow = ev < -1.9;

  // Interaction-first explanation: surface the single most salient lesson.
  let note: string;
  if (clipHigh) {
    note = 'Highlights are clipping — the brightest tones blow out to pure white. Close down or shorten the shutter.';
  } else if (clipLow) {
    note = 'Shadows are crushing — detail is lost in the blacks. Open up, slow the shutter, or raise ISO.';
  } else if (motionBlurPx > 6 && scene.motion >= 0.5) {
    note =
      scene.motionTarget === 'background'
        ? scene.kind === 'waterfall'
          ? 'A long exposure lets falling water silk into a continuous wash — that softness is your shutter speed made visible.'
          : 'Panning the camera with the subject holds it sharp while the background streaks past — that streak is your shutter speed made visible.'
        : 'A slow shutter lets the moving subject smear across the frame — that streak is your shutter speed made visible.';
  } else if (dofBlurPx > 6 && scene.dof >= 0.6) {
    note = 'Aperture and focal length together throw the background out — wide + long is how you isolate a subject.';
  } else if (Math.abs(tNorm) > 0.66) {
    note =
      tNorm > 0
        ? 'Your white balance is set warmer than the light — the scene is taking on an orange cast.'
        : 'Your white balance is set cooler than the light — the scene is going blue.';
  } else if (grainOpacity > 0.22) {
    note = ev < -0.6
      ? 'Underexposing and lifting reveals noise — expose to the right and the shadows stay clean.'
      : 'High ISO amplifies the signal — and the noise with it. Watch the grain build in the shadows.';
  } else if (Math.abs(ev) < 0.4) {
    note = 'Balanced exposure. The histogram sits centred — nothing crushed, nothing blown.';
  } else if (ev > 0) {
    note = 'Slightly bright. The histogram is shifting right — pleasing for a high-key look, risky for highlights.';
  } else {
    note = 'Slightly dark. The histogram is shifting left — protects highlights, but watch the shadows.';
  }

  return {
    ev: +ev.toFixed(2),
    sceneFilter,
    motionBlurPx,
    subjectBlurPx,
    bgMotionBlurPx,
    motionAxis: scene.motionAxis,
    dofBlurPx,
    bokehRadius,
    grainOpacity,
    fovScale,
    wbTintK,
    clipHigh,
    clipLow,
    note,
  };
}

/* ---- Tone presets (Log / LUT) ----
 * A purely visual lens on top of the simulated scene. `rec709` is the
 * "out of the box" look you've seen all along; `log` flattens the curve
 * the way a raw log capture would; `film` applies a contrasty graded
 * LUT. None of them touch the exposure math — they're a post-stage,
 * just like a real colour grade. The histogram still reports luminance
 * because the *captured* signal is still the same; only the display
 * mapping changes.
 */

export type TonePreset = 'rec709' | 'log' | 'film';

export const TONE_PRESETS: { id: TonePreset; label: string; hint: string }[] = [
  { id: 'rec709', label: '709', hint: 'Rec.709 — out-of-the-box look (linear-ish)' },
  { id: 'log', label: 'LOG', hint: 'Log — flat capture, milky highlights, lifted shadows' },
  { id: 'film', label: 'FILM', hint: 'Graded film LUT — punchy contrast, warm bias' },
];

export function applyTonePreset(d: Derived, preset: TonePreset): Derived {
  if (preset === 'rec709') return d;
  let extra = '';
  if (preset === 'log') {
    // Flat log curve: contrast way down, slight brightness lift, mild
    // desat — looks "milky" and unfinished, which is the point.
    extra = ' contrast(0.7) brightness(1.06) saturate(0.78)';
  } else if (preset === 'film') {
    // Graded film: punchy contrast, modest warm bias, saturated.
    extra = ' contrast(1.18) saturate(1.16) sepia(0.08)';
  }
  return { ...d, sceneFilter: d.sceneFilter + extra };
}

/* ---- Cinema mode ----
 * fps doesn't affect exposure (EV is light-per-frame; fps is frames-per-
 * second), so it's a pure UI-side concern. The relationship that matters
 * pedagogically is the *shutter angle*: how much of one frame's duration
 * the shutter is open. 180° (half the frame) is the cinematic norm.
 */

export const FPS_VALUES = [24, 25, 30, 48, 60, 120] as const;

export interface CinemaReadout {
  fps: number;
  /** Shutter angle in degrees, 0..360 (clamped — `1.0s` at 60fps would be
   *  60× a frame; we cap at 360 since the shutter cannot stay open longer
   *  than one frame in continuous cinema capture). */
  angleDeg: number;
  /** How the resulting motion feels on the screen. */
  feel: 'staccato' | 'cinematic' | 'smeary' | 'over-long';
  /** Short interaction-first note. */
  note: string;
}

export function shutterAngle(shutterSec: number, fps: number): CinemaReadout {
  const frameSec = 1 / fps;
  const angleRaw = (shutterSec / frameSec) * 360;
  const angleDeg = +clamp(angleRaw, 0, 360).toFixed(1);
  let feel: CinemaReadout['feel'];
  let note: string;
  if (angleRaw > 360) {
    feel = 'over-long';
    note = `Shutter is longer than one frame at ${fps} fps — outside the cinema envelope.`;
  } else if (angleDeg < 90) {
    feel = 'staccato';
    note = `${angleDeg}° — staccato, jittery motion. Think "Saving Private Ryan" beach scene.`;
  } else if (angleDeg <= 200) {
    feel = 'cinematic';
    note = `${angleDeg}° — natural cinematic motion. 180° is the classical sweet spot.`;
  } else {
    feel = 'smeary';
    note = `${angleDeg}° — heavy motion smear. Dreamy, but easily too much.`;
  }
  return { fps, angleDeg, feel, note };
}

/** Scope readout — derives waveform + vectorscope from the *model state*
 *  rather than from rendered pixels. Pedagogically honest: a real scope
 *  reads what the sensor sees; ours reads what the exposure model says
 *  the sensor would see. */
export interface ScopeReadout {
  /** N samples 0..1 — luminance per "column", left to right. */
  waveform: number[];
  /** Polar position of the dominant chroma on the unit circle. */
  vector: { x: number; y: number; magnitude: number };
}

export function scopeReadout(d: Derived, n = 36): ScopeReadout {
  const center = clamp(0.5 + d.ev * 0.13, 0.05, 0.95);
  const spread = 0.28 - d.grainOpacity * 0.18;
  const waveform: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Stable per-column wobble (no per-render jitter).
    const seed = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const z = (t - center) / spread;
    let v = Math.exp(-(z * z));
    v += Math.abs(seed) * d.grainOpacity * 0.5;
    if (d.clipHigh) v = Math.max(v, 0.96);
    if (d.clipLow && t < 0.22) v = Math.min(v, 0.04);
    waveform.push(+clamp(v, 0, 1).toFixed(3));
  }
  // Warm tint sits near orange (≈30°), cool near blue (≈210°). At neutral
  // WB (wbTintK === 0) the magnitude is 0 and the dot sits at origin.
  const tNorm = clamp(d.wbTintK / 3000, -1, 1);
  const magnitude = Math.abs(tNorm);
  const angle = tNorm >= 0 ? (30 * Math.PI) / 180 : (210 * Math.PI) / 180;
  return {
    waveform,
    vector: {
      x: +(Math.cos(angle) * magnitude).toFixed(3),
      y: +(Math.sin(angle) * magnitude).toFixed(3),
      magnitude: +magnitude.toFixed(3),
    },
  };
}

/** Nearest ladder index for a value (so a dial can snap to real stops). */
export function nearestIndex(values: readonly number[], v: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i] - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export interface FixSuggestion {
  /** Which dial the user should turn. */
  control: 'shutter' | 'aperture' | 'iso';
  fromIndex: number;
  toIndex: number;
  /** Signed stops of light this change adds (+ brightens, − darkens). */
  stops: number;
  /** Human label for the chip, e.g. `"open aperture 1 stop"`. */
  label: string;
}

/**
 * Pick the single cleanest one-click fix to bring exposure back to 0 EV.
 *
 * Avoids touching a control the scene's lesson depends on (don't suggest
 * speeding the shutter on a waterfall; don't suggest closing the aperture
 * on a portrait). Falls back to ISO when both shutter and aperture are
 * "locked" by the scene's identity. Returns `null` when exposure is
 * already close enough that no nudge would help.
 */
export function suggestFix(s: Settings, scene: Scene): FixSuggestion | null {
  const ev = evOffset(s, scene);
  if (Math.abs(ev) < 0.5) return null;
  const need = -Math.round(ev); // signed stops of light to add
  if (need === 0) return null;

  let control: 'shutter' | 'aperture' | 'iso';
  if (scene.motion < 0.6) control = 'shutter';
  else if (scene.dof < 0.6) control = 'aperture';
  else control = 'iso';

  let fromIndex: number;
  let toIndex: number;
  if (control === 'shutter') {
    fromIndex = nearestIndex(SHUTTER_VALUES, s.shutter);
    // Shutter ladder is fast → slow, so higher index = more light.
    toIndex = clamp(fromIndex + need, 0, SHUTTER_VALUES.length - 1);
  } else if (control === 'iso') {
    fromIndex = nearestIndex(ISO_VALUES, s.iso);
    toIndex = clamp(fromIndex + need, 0, ISO_VALUES.length - 1);
  } else {
    fromIndex = nearestIndex(APERTURE_VALUES, s.aperture);
    // Aperture ladder is wide → narrow, so higher index = less light.
    toIndex = clamp(fromIndex - need, 0, APERTURE_VALUES.length - 1);
  }
  if (toIndex === fromIndex) return null;

  const mag = Math.abs(need);
  const stops = `${mag} stop${mag > 1 ? 's' : ''}`;
  const word =
    control === 'shutter'
      ? need > 0
        ? `slow shutter ${stops}`
        : `speed shutter ${stops}`
      : control === 'aperture'
        ? need > 0
          ? `open aperture ${stops}`
          : `close aperture ${stops}`
        : need > 0
          ? `raise ISO ${stops}`
          : `lower ISO ${stops}`;

  return { control, fromIndex, toIndex, stops: need, label: word };
}

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

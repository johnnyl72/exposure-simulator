// Physics sanity check for the exposure model. Runs the *real* module
// (no re-implementation) and asserts the camera philosophies hold.
//
//   node --experimental-strip-types scripts/verify-exposure.ts
//
// This is documentation-as-code: each check names the principle it
// guards so regressions during page iteration are caught immediately.

import {
  SCENES,
  applyTonePreset,
  derive,
  evOffset,
  defaultSettings,
  scopeReadout,
  shutterAngle,
  suggestFix,
  type Scene,
  type Settings,
} from '../src/exposure.ts';
import { decodeShare, encodeShare } from '../src/share.ts';

let failures = 0;
const approx = (a: number, b: number, eps = 0.05) => Math.abs(a - b) <= eps;

function check(name: string, pass: boolean, detail = '') {
  const tag = pass ? '  ok  ' : ' FAIL ';
  if (!pass) failures++;
  console.log(`[${tag}] ${name}${detail ? `  — ${detail}` : ''}`);
}

const cafe = SCENES.find((s) => s.kind === 'cafe') as Scene;
const skater = SCENES.find((s) => s.kind === 'skater') as Scene;
const falls = SCENES.find((s) => s.kind === 'waterfall') as Scene;
const pan = SCENES.find((s) => s.kind === 'panning') as Scene;
const base = (sc: Scene): Settings => defaultSettings(sc);

// 1. Each scene's default settings are its correct exposure (0 EV).
for (const sc of SCENES) {
  check(
    `${sc.name}: default settings expose at 0 EV`,
    approx(evOffset(base(sc), sc), 0, 0.01),
    `EV=${evOffset(base(sc), sc).toFixed(3)}`,
  );
}

// 2. One stop = one doubling of light, per control.
{
  const s = base(cafe);
  const oneStopShutter = { ...s, shutter: s.shutter * 2 };
  check(
    'Shutter: doubling time = +1 stop',
    approx(evOffset(oneStopShutter, cafe), 1),
    `EV=${evOffset(oneStopShutter, cafe).toFixed(3)}`,
  );
  const oneStopIso = { ...s, iso: s.iso * 2 };
  check(
    'ISO: doubling ISO = +1 stop',
    approx(evOffset(oneStopIso, cafe), 1),
    `EV=${evOffset(oneStopIso, cafe).toFixed(3)}`,
  );
  const oneStopAp = { ...s, aperture: s.aperture * Math.SQRT2 };
  check(
    'Aperture: ×√2 f-number = −1 stop',
    approx(evOffset(oneStopAp, cafe), -1),
    `EV=${evOffset(oneStopAp, cafe).toFixed(3)}`,
  );
}

// 3. Reciprocity / equivalent exposure: trade a stop of shutter for a
//    stop of aperture and brightness is unchanged — but DOF changes.
{
  const s = base(cafe);
  const traded: Settings = {
    ...s,
    shutter: s.shutter / 2, // −1 stop light
    aperture: s.aperture / Math.SQRT2, // +1 stop light
  };
  check(
    'Reciprocity: shutter↓1 + aperture↑1 ⇒ same exposure',
    approx(evOffset(traded, cafe), 0, 0.02),
    `EV=${evOffset(traded, cafe).toFixed(3)}`,
  );
  check(
    'Reciprocity: …but the wider aperture gives more background blur',
    derive(traded, cafe).dofBlurPx > derive(s, cafe).dofBlurPx,
  );
}

// 4. ND filter darkens by its rated stops.
{
  const s = base(falls);
  const nd64 = { ...s, ndIndex: 3 }; // ND64 = 6 stops
  check(
    'ND64 = −6 stops',
    approx(evOffset(nd64, falls), -6),
    `EV=${evOffset(nd64, falls).toFixed(3)}`,
  );
}

// 5. Shutter philosophy: slower shutter ⇒ more motion blur on a moving
//    scene, and the relationship is dramatic (not flat).
{
  const frozen = derive({ ...base(skater), shutter: 1 / 2000 }, skater);
  const mid = derive({ ...base(skater), shutter: 1 / 60 }, skater);
  const silky = derive({ ...base(falls), shutter: 1 / 2 }, falls);
  check('Fast shutter freezes motion (≈0 blur)', frozen.motionBlurPx < 1, `${frozen.motionBlurPx}px`);
  check('Slower shutter ⇒ more blur', mid.motionBlurPx > frozen.motionBlurPx);
  check(
    'Long exposure on a waterfall is dramatically silky',
    silky.motionBlurPx > 14,
    `${silky.motionBlurPx}px`,
  );
}

// 6. Depth-of-field philosophy: wider aperture AND longer lens ⇒ more
//    background separation (the portrait-lens lesson).
{
  const wide = derive({ ...base(cafe), aperture: 1.4, focal: 85 }, cafe);
  const stopped = derive({ ...base(cafe), aperture: 16, focal: 85 }, cafe);
  const short = derive({ ...base(cafe), aperture: 1.4, focal: 24 }, cafe);
  const long = derive({ ...base(cafe), aperture: 1.4, focal: 85 }, cafe);
  check('Wide aperture ⇒ shallow DOF', wide.dofBlurPx > stopped.dofBlurPx);
  check('f/16 ⇒ deep focus (≈0 background blur)', stopped.dofBlurPx < 1, `${stopped.dofBlurPx}px`);
  check('Longer lens ⇒ more background blur at the same f-stop', long.dofBlurPx > short.dofBlurPx);
}

// 7. ISO philosophy: higher ISO ⇒ more grain; underexposing then lifting
//    also reveals noise (expose to the right).
{
  const lowIso = derive({ ...base(cafe), iso: 100 }, cafe);
  const highIso = derive({ ...base(cafe), iso: 12800 }, cafe);
  const under = derive({ ...base(cafe), shutter: base(cafe).shutter / 8 }, cafe); // −3 EV
  check('Higher ISO ⇒ more grain', highIso.grainOpacity > lowIso.grainOpacity);
  check('Underexposure adds noise (lifted shadows)', under.grainOpacity > lowIso.grainOpacity);
}

// 8. Motion direction: waterfalls smear the *background* vertically, the
//    skater smears *himself* horizontally, and a pan streaks the
//    *background* horizontally while the subject stays sharp.
{
  const fallsSilky = derive({ ...base(falls), shutter: 1 / 2 }, falls);
  check(
    'Waterfall: long exposure smears the background, not the subject',
    fallsSilky.bgMotionBlurPx > 14 && fallsSilky.subjectBlurPx < 0.5,
    `bg=${fallsSilky.bgMotionBlurPx}px subj=${fallsSilky.subjectBlurPx}px`,
  );
  check('Waterfall motion axis is vertical', fallsSilky.motionAxis === 'v');

  const skaterMid = derive({ ...base(skater), shutter: 1 / 60 }, skater);
  check(
    'Skater: a slow shutter smears the skater, not the background',
    skaterMid.subjectBlurPx > 0 && skaterMid.bgMotionBlurPx === 0,
  );

  const panDefault = derive(base(pan), pan);
  check(
    'Pan default: background streaks horizontally, subject stays sharp',
    panDefault.bgMotionBlurPx > 4 &&
      panDefault.subjectBlurPx === 0 &&
      panDefault.motionAxis === 'h',
    `bg=${panDefault.bgMotionBlurPx}px subj=${panDefault.subjectBlurPx}px`,
  );
}

// 9. Suggested-fix nudges: at ideal exposure there is no nudge; when off
//    by a stop or more there is exactly one cleanly-typed suggestion that
//    avoids touching the scene's signature control.
{
  check('No nudge needed when exposure is already ideal', suggestFix(base(cafe), cafe) === null);

  const dim = { ...base(cafe), shutter: base(cafe).shutter / 4 }; // −2 EV
  const fix = suggestFix(dim, cafe);
  check(
    'Underexposed cafe → suggests the most pedagogically-clean fix',
    fix !== null && fix.stops === 2,
    fix ? `${fix.label} (stops=${fix.stops})` : 'null',
  );

  const dimSkater = { ...base(skater), shutter: base(skater).shutter / 4 }; // −2 EV
  const skFix = suggestFix(dimSkater, skater);
  check(
    'Skater (shutter-locked) is fixed via aperture/ISO, never shutter',
    skFix !== null && skFix.control !== 'shutter',
    skFix ? skFix.label : 'null',
  );

  const dimPortrait = { ...base(cafe), aperture: 11 }; // ≈ −5.6 EV from f/1.8
  const cFix = suggestFix(dimPortrait, cafe);
  check(
    'Portrait (DOF-locked) is fixed via shutter/ISO, never aperture',
    cFix !== null && cFix.control !== 'aperture',
    cFix ? cFix.label : 'null',
  );
}

// 10. White-balance: setting WB to the scene's actual light is neutral;
//     above it warms, below it cools — and WB doesn't move EV.
{
  const neutralCafe = derive(base(cafe), cafe);
  check(
    'Cafe at scene WB (3200K) is colour-neutral (no tint filter)',
    neutralCafe.wbTintK === 0 && !/sepia/.test(neutralCafe.sceneFilter),
    `filter="${neutralCafe.sceneFilter}"`,
  );

  const warmCafe = derive({ ...base(cafe), wb: 7500 }, cafe);
  check(
    'WB > scene → image warms (sepia tint, no hue rotation)',
    warmCafe.wbTintK > 0 && /sepia/.test(warmCafe.sceneFilter) && /hue-rotate\(-\d/.test(warmCafe.sceneFilter),
    `filter="${warmCafe.sceneFilter}"`,
  );

  const coolCafe = derive({ ...base(cafe), wb: 2700 }, cafe);
  check(
    'WB < scene → image cools (sepia + ~180° hue rotate)',
    coolCafe.wbTintK < 0 && /sepia/.test(coolCafe.sceneFilter) && /hue-rotate\(18/.test(coolCafe.sceneFilter),
    `filter="${coolCafe.sceneFilter}"`,
  );

  check(
    'WB does not move EV',
    approx(evOffset({ ...base(cafe), wb: 8500 }, cafe), 0, 0.001),
  );
}

// 11. Share encoding: encode → decode round-trips every control faithfully,
//     and a missing/garbled hash decodes to null.
{
  const s = base(cafe);
  const tweaked: Settings = { ...s, shutter: 1 / 60, aperture: 1.4, iso: 1600, wb: 5500, focal: 85, ndIndex: 2 };
  const qs = encodeShare(cafe, tweaked);
  const round = decodeShare(`#/play?${qs}`);
  check(
    'Share round-trips scene + every dial',
    round !== null &&
      round.scene.kind === cafe.kind &&
      round.settings.iso === tweaked.iso &&
      round.settings.shutter === tweaked.shutter &&
      round.settings.aperture === tweaked.aperture &&
      round.settings.focal === tweaked.focal &&
      round.settings.ndIndex === tweaked.ndIndex &&
      round.settings.wb === tweaked.wb,
    qs,
  );
  check('Empty hash decodes to null', decodeShare('#/play') === null);
  check('Unknown scene decodes to null', decodeShare('#/play?scene=mars&i=0&s=0&a=0&f=0&nd=0&wb=0') === null);
  check('Out-of-range index decodes to null', decodeShare(`#/play?scene=cafe&i=99&s=0&a=0&f=0&nd=0&wb=0`) === null);
}

// 12. Scopes: vectorscope dot sits at origin at neutral WB, drifts toward
//     orange when WB > scene, toward blue when WB < scene. Waveform shifts
//     right as EV climbs, pegs at the top when highlights clip.
{
  const neutral = scopeReadout(derive(base(cafe), cafe));
  check(
    'Vectorscope: neutral WB ⇒ dot at origin',
    Math.abs(neutral.vector.x) < 1e-6 && Math.abs(neutral.vector.y) < 1e-6,
  );

  const warm = scopeReadout(derive({ ...base(cafe), wb: 8500 }, cafe));
  check(
    'Vectorscope: warm WB ⇒ dot in upper-right (orange) quadrant',
    warm.vector.x > 0.2 && warm.vector.y > 0.1,
    `vec=(${warm.vector.x}, ${warm.vector.y})`,
  );

  const cool = scopeReadout(derive({ ...base(cafe), wb: 2700 }, cafe));
  check(
    'Vectorscope: cool WB ⇒ dot in lower-left (blue) quadrant',
    cool.vector.x < -0.05 && cool.vector.y < -0.02,
    `vec=(${cool.vector.x}, ${cool.vector.y})`,
  );

  const dimEv = scopeReadout(derive({ ...base(cafe), shutter: base(cafe).shutter / 8 }, cafe));
  const brightEv = scopeReadout(derive({ ...base(cafe), shutter: base(cafe).shutter * 8 }, cafe));
  const peakBin = (w: number[]) => w.reduce((iMax, v, i, a) => (v > a[iMax] ? i : iMax), 0);
  check(
    'Waveform: brighter EV shifts the peak to the right',
    peakBin(brightEv.waveform) > peakBin(dimEv.waveform),
    `peaks: dim=${peakBin(dimEv.waveform)} bright=${peakBin(brightEv.waveform)}`,
  );
}

// 13. Cinema mode: shutter angle is `360 × shutter × fps`. 1/48s @ 24fps
//     is the classical 180° sweet spot. Faster shutters trend to staccato;
//     slower trend to smeary; longer than one frame is out-of-envelope.
{
  const cls = shutterAngle(1 / 48, 24);
  check(
    '1/48s @ 24fps = 180° (cinematic sweet spot)',
    Math.abs(cls.angleDeg - 180) < 0.5 && cls.feel === 'cinematic',
    `${cls.angleDeg}° (${cls.feel})`,
  );

  const fast = shutterAngle(1 / 4000, 24);
  check('Very fast shutter ⇒ staccato angle', fast.angleDeg < 90 && fast.feel === 'staccato', `${fast.angleDeg}° (${fast.feel})`);

  const slow = shutterAngle(1 / 30, 24);
  check('Slower-than-frame shutter ⇒ smeary', slow.angleDeg > 200 && slow.feel === 'smeary', `${slow.angleDeg}° (${slow.feel})`);

  const tooLong = shutterAngle(1, 24);
  check('Shutter longer than one frame ⇒ over-long', tooLong.feel === 'over-long');

  const sixty = shutterAngle(1 / 120, 60);
  check(
    '1/120s @ 60fps = 180° (cinematic at any fps when shutter is half the frame)',
    Math.abs(sixty.angleDeg - 180) < 0.5 && sixty.feel === 'cinematic',
  );
}

// 14. Tone presets are a pure visual lens — they extend the scene filter
//     without touching exposure stops, motion, DOF, or grain.
{
  const base709 = derive(base(cafe), cafe);
  const log = applyTonePreset(base709, 'log');
  const film = applyTonePreset(base709, 'film');
  const r709 = applyTonePreset(base709, 'rec709');

  check('rec709 is the identity preset', r709.sceneFilter === base709.sceneFilter);
  check(
    'LOG flattens contrast (filter contains "contrast(0.7…)")',
    /contrast\(0\.7/.test(log.sceneFilter),
    log.sceneFilter,
  );
  check(
    'FILM punches contrast (filter contains "contrast(1.1…)")',
    /contrast\(1\.1/.test(film.sceneFilter),
    film.sceneFilter,
  );
  check(
    'Tone presets do not move EV or grain',
    log.ev === base709.ev && film.grainOpacity === base709.grainOpacity,
  );
}

// 15. Clip flags must agree with the visual: at the high-clip threshold
//     the scene brightness is genuinely hot, not barely changed.
{
  const s = base(cafe);
  const hot = { ...s, shutter: s.shutter * 4 }; // +2 EV
  const d = derive(hot, cafe);
  const b = Number(d.sceneFilter.match(/brightness\(([\d.]+)\)/)![1]);
  check('At +2 EV the highlight clip flag is set', d.clipHigh);
  check('…and the image is visibly blown (brightness ≥ 1.8)', b >= 1.8, `brightness=${b}`);
}

console.log(
  failures === 0
    ? '\nAll exposure philosophies verified.'
    : `\n${failures} check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);

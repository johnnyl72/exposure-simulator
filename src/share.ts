// Hash-encoded settings → any exposure is a link.
//
// Format: `#/play?scene=cafe&i=2&s=7&a=1&f=3&nd=0&wb=3`
// All control values are *indices* into their ladders (compact, robust to
// future ladder edits since the unit is always "one stop").

import {
  APERTURE_VALUES,
  FOCAL_VALUES,
  ISO_VALUES,
  ND_VALUES,
  SCENES,
  SHUTTER_VALUES,
  WB_VALUES,
  nearestIndex,
  type Scene,
  type SceneKind,
  type Settings,
} from './exposure.ts';

export interface ShareState {
  scene: Scene;
  settings: Settings;
}

export function encodeShare(scene: Scene, settings: Settings): string {
  const params = new URLSearchParams({
    scene: scene.kind,
    i: String(nearestIndex(ISO_VALUES, settings.iso)),
    s: String(nearestIndex(SHUTTER_VALUES, settings.shutter)),
    a: String(nearestIndex(APERTURE_VALUES, settings.aperture)),
    f: String(nearestIndex(FOCAL_VALUES, settings.focal)),
    nd: String(settings.ndIndex),
    wb: String(nearestIndex(WB_VALUES, settings.wb)),
  });
  return params.toString();
}

export function decodeShare(hash: string): ShareState | null {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  if (!q) return null;
  const params = new URLSearchParams(q);
  const sceneKind = params.get('scene') as SceneKind | null;
  if (!sceneKind) return null;
  const scene = SCENES.find((s) => s.kind === sceneKind);
  if (!scene) return null;

  const idx = (key: string, ladder: readonly unknown[]) => {
    const raw = params.get(key);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= ladder.length) return null;
    return n;
  };

  const i = idx('i', ISO_VALUES);
  const s = idx('s', SHUTTER_VALUES);
  const a = idx('a', APERTURE_VALUES);
  const f = idx('f', FOCAL_VALUES);
  const nd = idx('nd', ND_VALUES);
  const wb = idx('wb', WB_VALUES);

  if (i === null || s === null || a === null || f === null || nd === null || wb === null) return null;

  return {
    scene,
    settings: {
      iso: ISO_VALUES[i],
      shutter: SHUTTER_VALUES[s],
      aperture: APERTURE_VALUES[a],
      focal: FOCAL_VALUES[f],
      ndIndex: nd,
      wb: WB_VALUES[wb],
    },
  };
}

/** Replace the current URL hash without firing a hashchange event. */
export function pushShareToUrl(scene: Scene, settings: Settings): void {
  const qs = encodeShare(scene, settings);
  history.replaceState(null, '', `#/play?${qs}`);
}

/** Build the full shareable absolute URL for the current exposure. */
export function buildShareUrl(scene: Scene, settings: Settings): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/play?${encodeShare(scene, settings)}`;
}

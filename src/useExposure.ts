// Shared exposure state hook — used by both the Hero (decorative-but-live
// dials) and the Simulator. Holds the camera settings, snaps them to the
// real stop ladders, and exposes index-based setters the Dial can drive.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APERTURE_VALUES,
  FOCAL_VALUES,
  ISO_VALUES,
  ND_VALUES,
  SHUTTER_VALUES,
  WB_VALUES,
  defaultSettings,
  derive,
  nearestIndex,
  type Scene,
  type Settings,
} from './exposure';

export function useExposure(scene: Scene, initial?: Settings) {
  const [settings, setSettings] = useState<Settings>(() => initial ?? defaultSettings(scene));

  // Re-centre on the scene's correct exposure whenever the scene changes —
  // but skip the very first render so a hydrated `initial` survives mount.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setSettings(defaultSettings(scene));
  }, [scene]);

  const idx = useMemo(
    () => ({
      iso: nearestIndex(ISO_VALUES, settings.iso),
      shutter: nearestIndex(SHUTTER_VALUES, settings.shutter),
      aperture: nearestIndex(APERTURE_VALUES, settings.aperture),
      focal: nearestIndex(FOCAL_VALUES, settings.focal),
      nd: settings.ndIndex,
      wb: nearestIndex(WB_VALUES, settings.wb),
    }),
    [settings],
  );

  const set = useMemo(
    () => ({
      iso: (i: number) => setSettings((s) => ({ ...s, iso: ISO_VALUES[i] })),
      shutter: (i: number) => setSettings((s) => ({ ...s, shutter: SHUTTER_VALUES[i] })),
      aperture: (i: number) => setSettings((s) => ({ ...s, aperture: APERTURE_VALUES[i] })),
      focal: (i: number) => setSettings((s) => ({ ...s, focal: FOCAL_VALUES[i] })),
      nd: (i: number) => setSettings((s) => ({ ...s, ndIndex: i })),
      wb: (i: number) => setSettings((s) => ({ ...s, wb: WB_VALUES[i] })),
      all: (next: Settings) => setSettings(next),
      reset: () => setSettings(defaultSettings(scene)),
    }),
    [scene],
  );

  const d = useMemo(() => derive(settings, scene), [settings, scene]);

  return { settings, idx, set, d };
}

export const LADDERS = {
  iso: ISO_VALUES,
  shutter: SHUTTER_VALUES,
  aperture: APERTURE_VALUES,
  focal: FOCAL_VALUES,
  nd: ND_VALUES,
  wb: WB_VALUES,
};

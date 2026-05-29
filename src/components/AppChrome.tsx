// Top app chrome — logo + nav. Ported from the wireframe `AppChrome`.
// Only LEARN (hero) and PLAY (simulator) navigate in this MVP; the
// remaining items are present per the wireframe but intentionally inert.

import { WF } from '../theme';

export type View = 'hero' | 'sim' | 'compare' | 'lesson';

const ITEMS: { label: string; view?: View }[] = [
  { label: 'LEARN', view: 'hero' },
  { label: 'LESSONS', view: 'lesson' },
  { label: 'PLAY', view: 'sim' },
  { label: 'COMPARE', view: 'compare' },
  { label: 'LABS' },
];

export function AppChrome({
  active,
  onNavigate,
  dark = false,
}: {
  active: 'LEARN' | 'LESSONS' | 'PLAY' | 'SCENES' | 'COMPARE' | 'LABS';
  onNavigate: (v: View) => void;
  dark?: boolean;
}) {
  const fg = dark ? '#fff' : WF.ink;
  const dim = dark ? 'rgba(255,255,255,0.45)' : WF.ink3;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        borderBottom: `1.2px solid ${dark ? 'rgba(255,255,255,0.14)' : WF.ink3}`,
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <circle cx="11" cy="11" r="9" fill="none" stroke={fg} strokeWidth="1.6" />
          <circle cx="11" cy="11" r="4" fill={fg} />
        </svg>
        <span
          className="wf-mono"
          style={{ fontSize: 12, letterSpacing: '0.18em', fontWeight: 500, color: fg }}
        >
          EXPOSURE / LAB
        </span>
      </div>
      <nav style={{ display: 'flex', gap: 18 }}>
        {ITEMS.map((i) => {
          const isActive = i.label === active;
          const clickable = !!i.view;
          return (
            <button
              key={i.label}
              type="button"
              disabled={!clickable}
              onClick={() => i.view && onNavigate(i.view)}
              className="wf-mono"
              title={clickable ? undefined : 'Coming in a later phase'}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                fontSize: 11,
                letterSpacing: '0.12em',
                color: isActive ? fg : dim,
                borderBottom: isActive ? `1.5px solid ${WF.amber}` : '1.5px solid transparent',
                cursor: clickable ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {i.label}
            </button>
          );
        })}
      </nav>
      <span className="wf-mono" style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.6)' : WF.ink2 }}>
        sign in · ⌘K
      </span>
    </div>
  );
}

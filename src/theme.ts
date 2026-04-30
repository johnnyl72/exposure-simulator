// Design tokens — ported verbatim from the wireframe bundle's
// `wireframe-primitives.jsx` so the production app keeps the chosen lo-fi
// sketch aesthetic (warm paper, ink strokes, single amber accent).

export const WF = {
  ink: '#1f1b15',
  ink2: 'rgba(31,27,21,0.55)',
  ink3: 'rgba(31,27,21,0.32)',
  paper: '#f0eee9',
  panel: '#e7e3da',
  hatch: 'rgba(31,27,21,0.08)',
  amber: '#c96442',
  amberSoft: 'rgba(201,100,66,0.18)',
  fontHand: '"Caveat", "Patrick Hand", "Architects Daughter", cursive',
  fontMono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
  fontSans: '"Inter", -apple-system, system-ui, sans-serif',
} as const;

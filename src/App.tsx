import { useEffect, useState } from 'react';
import { Hero } from './screens/Hero';
import { Simulator } from './screens/Simulator';
import { Compare } from './screens/Compare';
import { Lesson } from './screens/Lesson';
import type { View } from './components/AppChrome';

const viewFromHash = (): View => {
  const h = window.location.hash;
  if (h.startsWith('#/play')) return 'sim';
  if (h.startsWith('#/compare')) return 'compare';
  if (h.startsWith('#/lesson')) return 'lesson';
  return 'hero';
};

const hashFor: Record<View, string> = {
  hero: '#/',
  sim: '#/play',
  compare: '#/compare',
  lesson: '#/lesson/1',
};

export default function App() {
  const [view, setView] = useState<View>(viewFromHash);

  // Keep the URL hash in sync so each screen is linkable and the
  // browser back button moves between them.
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (v: View) => {
    window.location.hash = hashFor[v];
    setView(v);
  };

  if (view === 'sim') return <Simulator onNavigate={navigate} />;
  if (view === 'compare') return <Compare onNavigate={navigate} />;
  if (view === 'lesson') return <Lesson onNavigate={navigate} />;
  return <Hero onNavigate={navigate} />;
}

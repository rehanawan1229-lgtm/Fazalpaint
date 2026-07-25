import { useEffect, useRef, useState } from 'react';

export function useScrollProgress(trackRef) {
  const [progress, setProgress] = useState(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    const computeProgress = () => {
      const el = trackRef.current;
      if (!el) {
        tickingRef.current = false;
        return;
      }
      const rect = el.getBoundingClientRect();
      const trackHeight = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      const raw = trackHeight > 0 ? scrolled / trackHeight : 0;
      setProgress(Math.min(1, Math.max(0, raw)));
      tickingRef.current = false;
    };

    const onScroll = () => {
      if (!tickingRef.current) {
        tickingRef.current = true;
        requestAnimationFrame(computeProgress);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    computeProgress();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [trackRef]);

  return progress;
}

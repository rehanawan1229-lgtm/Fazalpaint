import { useEffect, useMemo, useState } from 'react';
import { HERO_FRAME_COUNT, HERO_FRAME_PATH } from './heroFrames';

export function useFramePreloader() {
  const [images, setImages] = useState([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [preloadFailed, setPreloadFailed] = useState(false);

  const frameIndexes = useMemo(() => Array.from({ length: HERO_FRAME_COUNT }, (_, i) => i + 1), []);

  useEffect(() => {
    let cancelled = false;
    const loaded = new Array(HERO_FRAME_COUNT);

    const loadPromises = frameIndexes.map((frameNumber, index) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (cancelled) return resolve();
          loaded[index] = img;
          setLoadedCount((count) => count + 1);
          resolve();
        };
        img.onerror = () => {
          setPreloadFailed(true);
          resolve();
        };
        img.src = HERO_FRAME_PATH(frameNumber);
      })
    );

    Promise.all(loadPromises).then(() => {
      if (!cancelled) {
        setImages(loaded.filter(Boolean));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [frameIndexes]);

  const isReady = loadedCount === HERO_FRAME_COUNT && !preloadFailed;
  const progressPct = Math.round((loadedCount / HERO_FRAME_COUNT) * 100);

  return { images, loadedCount, isReady, progressPct, preloadFailed };
}

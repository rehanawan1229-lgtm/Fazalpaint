export const HERO_FRAME_COUNT = 300;
export const HERO_FRAME_PATH = (index) => `/hero-frames/frame-${String(index).padStart(4, '0')}.webp`;

export function getHeroFrameIndexes() {
  return Array.from({ length: HERO_FRAME_COUNT }, (_, index) => index + 1);
}

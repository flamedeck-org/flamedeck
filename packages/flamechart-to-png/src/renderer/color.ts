import type { Frame, Profile } from '@flamedeck/speedscope-core/profile';

// Replicate logic from getters.ts
export const getFrameToColorBucket = (profile: Profile): Map<string | number, number> => {
  const frames: Frame[] = [];
  profile.forEachFrame((f) => frames.push(f));
  function key(f: Frame) {
    return (f.file || '') + f.name;
  }
  function compare(a: Frame, b: Frame) {
    return key(a) > key(b) ? 1 : -1;
  }
  frames.sort(compare);
  const frameToColorBucket = new Map<string | number, number>();
  const n = frames.length;
  for (let i = 0; i < n; i++) {
    const bucket = n === 0 ? 0 : Math.floor((255 * i) / n);
    frameToColorBucket.set(frames[i].key, bucket);
  }
  return frameToColorBucket;
};

export const createGetColorBucketForFrame = (frameToColorBucket: Map<number | string, number>) => {
  return (frame: Frame): number => {
    // Default to 0 if frame.key is somehow not in the map
    return frameToColorBucket.get(frame.key) ?? 0;
  };
};

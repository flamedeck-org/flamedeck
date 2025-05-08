// https://github.com/brendangregg/FlameGraph#2-fold-stacks

import type { Profile, FrameInfo } from '../speedscope-core/profile.ts';
import { StackListProfileBuilder } from '../speedscope-core/profile.ts';
import type { TextFileContent } from './importer-utils.ts';

interface BGSample {
  stack: FrameInfo[];
  duration: number;
}

function parseBGFoldedStacks(contents: TextFileContent): BGSample[] {
  const samples: BGSample[] = [];
  for (const line of contents.splitLines()) {
    const match = /^(.*) (\d+)$/gm.exec(line);
    if (!match) continue;
    const stack = match[1];
    const n = match[2];

    samples.push({
      stack: stack.split(';').map((name) => ({ key: name, name: name })),
      duration: parseInt(n, 10),
    });
  }

  return samples;
}

export function importFromBGFlameGraph(contents: TextFileContent): Profile | null {
  const parsed = parseBGFoldedStacks(contents);
  const duration = parsed.reduce((prev: number, cur: BGSample) => prev + cur.duration, 0);
  const profile = new StackListProfileBuilder(duration);
  if (parsed.length === 0) {
    return null;
  }
  for (const sample of parsed) {
    profile.appendSampleWithWeight(sample.stack, sample.duration);
  }
  return profile.build();
}

import type { Color } from '@flamedeck/speedscope-core/color';

export interface Theme {
  fgPrimaryColor: string;
  fgSecondaryColor: string;
  bgPrimaryColor: string;
  bgSecondaryColor: string;

  altFgPrimaryColor: string;
  altFgSecondaryColor: string;
  altBgPrimaryColor: string;
  altBgSecondaryColor: string;

  selectionPrimaryColor: string;
  selectionSecondaryColor: string;

  weightColor: string;

  searchMatchTextColor: string;
  searchMatchPrimaryColor: string;
  searchMatchSecondaryColor: string;

  colorForBucket: (t: number) => Color;
  colorForBucketGLSL: string;
}

export interface FlamegraphTheme {
  colorForBucket: (t: number) => Color;
  colorForBucketGLSL: string;
  flamegraphTextColor: string; // Required for flamegraph themes
}

// Type for the theme registry structure (holding light/dark variants)
export type FlamegraphThemeVariants = {
  light: FlamegraphTheme;
  dark: FlamegraphTheme;
  // flamegraphTextColor will be part of FlamegraphTheme
};

// Names for the available flamegraph themes
// 'system' uses the default provided by the light/dark theme
export type FlamegraphThemeName = 'system' | 'fire' | 'peach' | 'ice';

import type { Theme, FlamegraphThemeName } from '@flamedeck/speedscope-theme/types';
import { lightTheme } from '@flamedeck/speedscope-theme/light-theme';
import { darkTheme } from '@flamedeck/speedscope-theme/dark-theme';
import { flamegraphThemeRegistry } from '@flamedeck/speedscope-theme/flamegraph-theme-registry';

interface ComposeThemeOptions {
  mode?: 'light' | 'dark';
  flamegraphThemeName?: FlamegraphThemeName;
}

export function composeTheme({ mode = 'light', flamegraphThemeName }: ComposeThemeOptions): Theme {
  const baseTheme = mode === 'dark' ? darkTheme : lightTheme;
  let finalTheme: Theme = baseTheme;

  if (flamegraphThemeName && flamegraphThemeName !== 'system') {
    const variants = flamegraphThemeRegistry[flamegraphThemeName];
    if (variants) {
      const flamegraphThemeOverride = mode === 'dark' ? variants.dark : variants.light;
      if (flamegraphThemeOverride) {
        finalTheme = { ...baseTheme, ...flamegraphThemeOverride };
      }
    }
  }
  return finalTheme;
}

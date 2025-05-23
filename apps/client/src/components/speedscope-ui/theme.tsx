import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ColorScheme, colorSchemeAtom } from '../../lib/speedscope-core/app-state/color-scheme.ts';
import { useAtom } from '../../lib/speedscope-core/atom.ts';
import type { Color } from '@flamedeck/speedscope-core/color';
import { memoizeByReference } from '@flamedeck/speedscope-core/lib-utils';
import { darkTheme } from '@flamedeck/speedscope-theme/dark-theme';
import { lightTheme } from '@flamedeck/speedscope-theme/light-theme';
import { Atom } from '../../lib/speedscope-core/atom.ts';
import {
  flamegraphThemeDisplayNames,
  flamegraphThemeRegistry,
} from '@flamedeck/speedscope-theme/flamegraph-theme-registry';
import type { FlamegraphThemeName, Theme } from '@flamedeck/speedscope-theme/types.ts';

// Specific interface for flamegraph coloring
export interface FlamegraphTheme {
  colorForBucket: (t: number) => Color;
  colorForBucketGLSL: string;
  flamegraphTextColor: string; // Required for flamegraph themes
}

const FLAMEGRAPH_THEME_STORAGE_KEY = 'flamegraphTheme';

// Helper to safely get the theme name from storage
function getInitialFlamegraphTheme(): FlamegraphThemeName {
  try {
    const storedValue = localStorage.getItem(FLAMEGRAPH_THEME_STORAGE_KEY);
    if (storedValue && storedValue in flamegraphThemeDisplayNames) {
      return storedValue as FlamegraphThemeName;
    }
  } catch (e) {
    console.error('Failed to read flamegraph theme from localStorage', e);
  }
  return 'system'; // Default value
}

// Atom to store the currently selected flamegraph theme name, initialized from storage
export const flamegraphThemeAtom = new Atom<FlamegraphThemeName>(
  getInitialFlamegraphTheme(),
  'flamegraphTheme' // Debug key
);

export const ThemeContext = createContext<Theme>(lightTheme);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function withTheme<T>(cb: (theme: Theme) => T) {
  return memoizeByReference(cb);
}

function matchMediaDarkColorScheme(): MediaQueryList {
  return matchMedia('(prefers-color-scheme: dark)');
}

export function colorSchemeToString(scheme: ColorScheme): string {
  switch (scheme) {
    case ColorScheme.SYSTEM: {
      return 'System';
    }
    case ColorScheme.DARK: {
      return 'Dark';
    }
    case ColorScheme.LIGHT: {
      return 'Light';
    }
  }
  // Add a default return or throw an error for exhaustive check
  throw new Error(`Unhandled ColorScheme: ${scheme}`);
}

export function ThemeProvider(props: { children: React.ReactNode }) {
  const [systemPrefersDarkMode, setSystemPrefersDarkMode] = useState(
    () => matchMediaDarkColorScheme().matches
  );

  const matchMediaListener = useCallback(
    (event: MediaQueryListEvent) => {
      setSystemPrefersDarkMode(event.matches);
    },
    [setSystemPrefersDarkMode]
  );

  useEffect(() => {
    const media = matchMediaDarkColorScheme();
    media.addEventListener('change', matchMediaListener);
    return () => {
      media.removeEventListener('change', matchMediaListener);
    };
  }, [matchMediaListener]);

  const colorScheme = useAtom(colorSchemeAtom);
  const selectedFlamegraphThemeName = useAtom(flamegraphThemeAtom);

  // Determine if we are in dark mode
  const isDarkMode =
    colorScheme === ColorScheme.DARK ||
    (colorScheme === ColorScheme.SYSTEM && systemPrefersDarkMode);

  const baseTheme = isDarkMode ? darkTheme : lightTheme;

  // Effect to persist theme selection to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FLAMEGRAPH_THEME_STORAGE_KEY, selectedFlamegraphThemeName);
    } catch (e) {
      console.error('Failed to save flamegraph theme to localStorage', e);
    }
  }, [selectedFlamegraphThemeName]);

  // Get the appropriate flamegraph theme variant (light or dark)
  let flamegraphThemeOverride: FlamegraphTheme | null = null;
  if (selectedFlamegraphThemeName !== 'system') {
    const variants = flamegraphThemeRegistry[selectedFlamegraphThemeName];
    if (variants) {
      flamegraphThemeOverride = isDarkMode ? variants.dark : variants.light;
    }
  }

  // Combine base theme with selected flamegraph theme variant
  const finalTheme: Theme = flamegraphThemeOverride
    ? { ...baseTheme, ...flamegraphThemeOverride }
    : baseTheme;

  useEffect(() => {
    const root = window.document.documentElement;
    const isDarkMode =
      colorScheme === ColorScheme.DARK ||
      (colorScheme === ColorScheme.SYSTEM && systemPrefersDarkMode);

    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [colorScheme, systemPrefersDarkMode]);

  return <ThemeContext.Provider value={finalTheme} children={props.children} />;
}

export { colorSchemeAtom, ColorScheme };

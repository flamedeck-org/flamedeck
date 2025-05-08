import React, { ComponentChildren, createContext, useCallback, useContext, useEffect, useState } from 'react'
import {ColorScheme, colorSchemeAtom} from '../../../lib/speedscope-core/app-state/color-scheme.ts'
import {useAtom} from '../../../lib/speedscope-core/atom.ts'
import type {Color} from '../../../lib/speedscope-core/color.ts'
import {memoizeByReference} from '../../../lib/speedscope-core/lib-utils.ts'
import {darkTheme} from './dark-theme.ts'
import {lightTheme} from './light-theme.ts'
import { Atom } from '../../../lib/speedscope-core/atom.ts'
import { flamegraphThemeRegistry } from './flamegraph-theme-registry.ts'

// Define common colors if needed elsewhere, or just use literal
const WHITE = '#FFFFFF';

export interface Theme {
  fgPrimaryColor: string
  fgSecondaryColor: string
  bgPrimaryColor: string
  bgSecondaryColor: string

  altFgPrimaryColor: string
  altFgSecondaryColor: string
  altBgPrimaryColor: string
  altBgSecondaryColor: string

  selectionPrimaryColor: string
  selectionSecondaryColor: string

  weightColor: string

  searchMatchTextColor: string
  searchMatchPrimaryColor: string
  searchMatchSecondaryColor: string

  colorForBucket: (t: number) => Color
  colorForBucketGLSL: string
  flamegraphTextColor?: string // Optional on base Theme
}

// Specific interface for flamegraph coloring
export interface FlamegraphTheme {
  colorForBucket: (t: number) => Color
  colorForBucketGLSL: string
  flamegraphTextColor: string // Required for flamegraph themes
}

// Names for the available flamegraph themes
// 'system' uses the default provided by the light/dark theme
export type FlamegraphThemeName = 'system' | 'fire' | 'peach' | 'ice'

// Define display names for themes
export const flamegraphThemeDisplayNames: Record<FlamegraphThemeName, string> = {
  system: 'Default',
  fire: 'Fire',
  peach: 'Peach',
  ice: 'Ice',
}

// Define simple CSS gradient previews for themes
export const flamegraphThemePreviews: Partial<Record<FlamegraphThemeName, string>> = {
  system: 'linear-gradient(to right,rgb(83, 69, 165),rgb(158, 63, 61),rgb(92, 159, 53))', // White -> Black
  fire: 'linear-gradient(to right, #a00000, #ff4500, #ffae42)', // Dark Red -> Orange -> Orange-Yellow
  peach: 'linear-gradient(to right, #d2691e, #ff8c69, #ffd700)', // Chocolate -> Salmon -> Gold
  ice: 'linear-gradient(to right,rgb(74, 173, 203),rgb(110, 93, 176),rgb(49, 166, 108))', // Black -> Black -> Black
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
    console.error("Failed to read flamegraph theme from localStorage", e);
  }
  return 'system'; // Default value
}

// Atom to store the currently selected flamegraph theme name, initialized from storage
export const flamegraphThemeAtom = new Atom<FlamegraphThemeName>(
  getInitialFlamegraphTheme(), 
  'flamegraphTheme' // Debug key
);

// Type for the theme registry structure (holding light/dark variants)
export type FlamegraphThemeVariants = {
  light: FlamegraphTheme
  dark: FlamegraphTheme
  // flamegraphTextColor will be part of FlamegraphTheme
}

export const ThemeContext = createContext<Theme>(lightTheme)

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

export function withTheme<T>(cb: (theme: Theme) => T) {
  return memoizeByReference(cb)
}

function matchMediaDarkColorScheme(): MediaQueryList {
  return matchMedia('(prefers-color-scheme: dark)')
}

export function colorSchemeToString(scheme: ColorScheme): string {
  switch (scheme) {
    case ColorScheme.SYSTEM: {
      return 'System'
    }
    case ColorScheme.DARK: {
      return 'Dark'
    }
    case ColorScheme.LIGHT: {
      return 'Light'
    }
  }
  // Add a default return or throw an error for exhaustive check
  throw new Error(`Unhandled ColorScheme: ${scheme}`)
}

function getTheme(colorScheme: ColorScheme, systemPrefersDarkMode: boolean): Theme {
  switch (colorScheme) {
    case ColorScheme.SYSTEM: {
      return systemPrefersDarkMode ? darkTheme : lightTheme
    }
    case ColorScheme.DARK: {
      return darkTheme
    }
    case ColorScheme.LIGHT: {
      return lightTheme
    }
  }
  // Add a default return or throw an error for exhaustive check
  throw new Error(`Unhandled ColorScheme: ${colorScheme}`)
}

export function ThemeProvider(props: {children: React.ReactNode}) {
  const [systemPrefersDarkMode, setSystemPrefersDarkMode] = useState(
    () => matchMediaDarkColorScheme().matches,
  )

  const matchMediaListener = useCallback(
    (event: MediaQueryListEvent) => {
      setSystemPrefersDarkMode(event.matches)
    },
    [setSystemPrefersDarkMode],
  )

  useEffect(() => {
    const media = matchMediaDarkColorScheme()
    media.addEventListener('change', matchMediaListener)
    return () => {
      media.removeEventListener('change', matchMediaListener)
    }
  }, [matchMediaListener])

  const colorScheme = useAtom(colorSchemeAtom)
  const selectedFlamegraphThemeName = useAtom(flamegraphThemeAtom)

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
      console.error("Failed to save flamegraph theme to localStorage", e);
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
    : baseTheme

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

  return <ThemeContext.Provider value={finalTheme} children={props.children} />
}

export { colorSchemeAtom }

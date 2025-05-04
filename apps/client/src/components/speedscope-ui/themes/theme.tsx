import React, { ComponentChildren, createContext, useCallback, useContext, useEffect, useState } from 'react'
import {ColorScheme, colorSchemeAtom} from '../../../lib/speedscope-core/app-state/color-scheme.ts'
import {useAtom} from '../../../lib/speedscope-core/atom.ts'
import {Color} from '../../../lib/speedscope-core/color.ts'
import {memoizeByReference} from '../../../lib/speedscope-core/lib-utils.ts'
import {darkTheme} from './dark-theme.ts'
import {lightTheme} from './light-theme.ts'
import { Atom } from '../../../lib/speedscope-core/atom.ts'
import { flamegraphThemeRegistry } from './flamegraph-theme-registry.ts'

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
}

// Specific interface for flamegraph coloring
export interface FlamegraphTheme {
  colorForBucket: (t: number) => Color
  colorForBucketGLSL: string
}

// Names for the available flamegraph themes
// 'system' uses the default provided by the light/dark theme
export type FlamegraphThemeName = 'system' | 'fire' | 'peach'

// Define display names for themes
export const flamegraphThemeDisplayNames: Record<FlamegraphThemeName, string> = {
  system: 'System Default',
  fire: 'Fire',
  peach: 'Peach',
}

// Atom to store the currently selected flamegraph theme name
export const flamegraphThemeAtom = new Atom<FlamegraphThemeName>('system', 'flamegraphTheme')

// Type for the theme registry structure (holding light/dark variants)
export type FlamegraphThemeVariants = {
  light: FlamegraphTheme
  dark: FlamegraphTheme
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

  // Get the appropriate flamegraph theme variant (light or dark)
  let flamegraphThemeOverride: FlamegraphTheme | null = null;
  if (selectedFlamegraphThemeName !== 'system') {
    const variants = flamegraphThemeRegistry[selectedFlamegraphThemeName];
    if (variants) {
      flamegraphThemeOverride = isDarkMode ? variants.dark : variants.light;
    }
  }

  // Combine base theme with selected flamegraph theme variant
  const finalTheme = flamegraphThemeOverride
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

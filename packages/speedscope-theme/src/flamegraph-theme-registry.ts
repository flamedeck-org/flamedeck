import { fireFlamegraphThemeLight } from './fire/light.ts';
import { fireFlamegraphThemeDark } from './fire/dark.ts';
import { peachFlamegraphThemeLight } from './peach/light.ts';
import { peachFlamegraphThemeDark } from './peach/dark.ts';
import { iceFlamegraphThemeLight } from './ice/light.ts';
import { iceFlamegraphThemeDark } from './ice/dark.ts';
import type { FlamegraphThemeName, FlamegraphThemeVariants } from './types.ts';

// Registry mapping theme names to their light/dark implementations
export const flamegraphThemeRegistry: Partial<
  Record<FlamegraphThemeName, FlamegraphThemeVariants>
> = {
  fire: {
    light: fireFlamegraphThemeLight,
    dark: fireFlamegraphThemeDark,
  },
  peach: {
    light: peachFlamegraphThemeLight,
    dark: peachFlamegraphThemeDark,
  },
  ice: {
    light: iceFlamegraphThemeLight,
    dark: iceFlamegraphThemeDark,
  },
};

// Define display names for themes
export const flamegraphThemeDisplayNames: Record<FlamegraphThemeName, string> = {
  system: 'Default',
  fire: 'Fire',
  peach: 'Peach',
  ice: 'Ice',
};

// Define simple CSS gradient previews for themes
export const flamegraphThemePreviews: Partial<Record<FlamegraphThemeName, string>> = {
  system: 'linear-gradient(to right,rgb(83, 69, 165),rgb(158, 63, 61),rgb(92, 159, 53))', // White -> Black
  fire: 'linear-gradient(to right, #a00000, #ff4500, #ffae42)', // Dark Red -> Orange -> Orange-Yellow
  peach: 'linear-gradient(to right, #d2691e, #ff8c69, #ffd700)', // Chocolate -> Salmon -> Gold
  ice: 'linear-gradient(to right,rgb(74, 173, 203),rgb(110, 93, 176),rgb(49, 166, 108))', // Black -> Black -> Black
};

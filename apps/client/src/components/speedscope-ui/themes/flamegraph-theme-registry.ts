import { FlamegraphThemeName, FlamegraphThemeVariants } from './theme.tsx'
import { fireFlamegraphThemeLight } from './fire/light.ts'
import { fireFlamegraphThemeDark } from './fire/dark.ts'
import { peachFlamegraphThemeLight } from './peach/light.ts'
import { peachFlamegraphThemeDark } from './peach/dark.ts'

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
}
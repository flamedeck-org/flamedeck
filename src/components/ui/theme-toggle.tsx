import * as React from "react";
import { Moon, Sun, Check } from "lucide-react";
import { useAtom } from "@/lib/speedscope-core/atom"; // Adjusted path
import { colorSchemeAtom } from "@/components/speedscope-ui/themes/theme"; // Adjusted path
import { ColorScheme } from "@/lib/speedscope-core/app-state/color-scheme"; // Adjusted path

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const colorScheme = useAtom(colorSchemeAtom);
  const setColorScheme = colorSchemeAtom.set; // Get the setter directly from the atom

  // Determine current effective theme (light or dark) for icon display
  const [effectiveTheme, setEffectiveTheme] = React.useState<'light' | 'dark'>(() => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return colorScheme === ColorScheme.DARK || (colorScheme === ColorScheme.SYSTEM && systemPrefersDark) ? 'dark' : 'light';
  });

  // Update effective theme when colorScheme or system preference changes
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const systemPrefersDark = mediaQuery.matches;
      setEffectiveTheme(colorScheme === ColorScheme.DARK || (colorScheme === ColorScheme.SYSTEM && systemPrefersDark) ? 'dark' : 'light');
    };

    handleChange(); // Initial check
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [colorScheme]);


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setColorScheme(ColorScheme.LIGHT)} className="flex items-center justify-between">
          Light
          {colorScheme === ColorScheme.LIGHT && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme(ColorScheme.DARK)} className="flex items-center justify-between">
          Dark
          {colorScheme === ColorScheme.DARK && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme(ColorScheme.SYSTEM)} className="flex items-center justify-between">
          System
          {colorScheme === ColorScheme.SYSTEM && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
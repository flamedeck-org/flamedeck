import * as React from 'react';
import { Moon, Sun, Check, Monitor } from 'lucide-react';
import { useAtom } from '@/lib/speedscope-core/atom'; // Adjusted path
import { colorSchemeAtom } from '@/components/speedscope-ui/theme'; // Adjusted path
import { ColorScheme } from '@/lib/speedscope-core/app-state/color-scheme'; // Adjusted path
import { useTheme } from 'next-themes'; // Import useTheme

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme(); // Use next-themes hook
  const speedscopeColorScheme = useAtom(colorSchemeAtom);
  const setSpeedscopeColorScheme = colorSchemeAtom.set;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden group"
        >
          {/* Background gradient on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Icons with improved transitions */}
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-yellow-500" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-blue-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-background/95 backdrop-blur-lg border border-border shadow-xl rounded-xl p-2 min-w-[160px]"
      >
        <DropdownMenuItem
          onClick={() => {
            setTheme('light');
            setSpeedscopeColorScheme(ColorScheme.LIGHT);
          }}
          icon={<Sun className="h-4 w-4 text-yellow-500" />}
          iconVariant="accent"
          rightContent={(theme === 'light' || speedscopeColorScheme === ColorScheme.LIGHT) && (
            <Check className="h-4 w-4 text-red-500" />
          )}
        >
          Light
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            setTheme('dark');
            setSpeedscopeColorScheme(ColorScheme.DARK);
          }}
          icon={<Moon className="h-4 w-4 text-blue-400" />}
          iconVariant="secondary"
          rightContent={(theme === 'dark' || speedscopeColorScheme === ColorScheme.DARK) && (
            <Check className="h-4 w-4 text-red-500" />
          )}
        >
          Dark
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            setTheme('system');
            setSpeedscopeColorScheme(ColorScheme.SYSTEM);
          }}
          icon={<Monitor className="h-4 w-4 text-muted-foreground" />}
          iconVariant="default"
          rightContent={(theme === 'system' || speedscopeColorScheme === ColorScheme.SYSTEM) && (
            <Check className="h-4 w-4 text-red-500" />
          )}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import * as React from "react";
import { Moon, Sun, Check } from "lucide-react";
import { useAtom } from "@/lib/speedscope-core/atom"; // Adjusted path
import { colorSchemeAtom } from "@/components/speedscope-ui/themes/theme"; // Adjusted path
import { ColorScheme } from "@/lib/speedscope-core/app-state/color-scheme"; // Adjusted path
import { useTheme } from "next-themes"; // Import useTheme

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme(); // Use next-themes hook
  const speedscopeColorScheme = useAtom(colorSchemeAtom);
  const setSpeedscopeColorScheme = colorSchemeAtom.set;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {/* Icons are handled by Tailwind dark: variants now */}
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => { 
            setTheme('light'); 
            setSpeedscopeColorScheme(ColorScheme.LIGHT); 
          }} 
          className="flex items-center justify-between"
        >
          Light
          {speedscopeColorScheme === ColorScheme.LIGHT && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => { 
            setTheme('dark'); 
            setSpeedscopeColorScheme(ColorScheme.DARK); 
          }} 
          className="flex items-center justify-between"
        >
          Dark
          {speedscopeColorScheme === ColorScheme.DARK && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => { 
            setTheme('system'); 
            setSpeedscopeColorScheme(ColorScheme.SYSTEM); 
          }} 
          className="flex items-center justify-between"
        >
          System
          {speedscopeColorScheme === ColorScheme.SYSTEM && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
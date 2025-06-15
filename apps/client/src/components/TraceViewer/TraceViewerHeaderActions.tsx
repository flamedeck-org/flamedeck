import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { flamegraphThemeAtom } from '@/components/speedscope-ui/theme';
import {
  flamegraphThemeDisplayNames,
  flamegraphThemePreviews,
} from '@flamedeck/speedscope-theme/flamegraph-theme-registry';
import type { FlamegraphThemeName } from '@flamedeck/speedscope-theme/types';
import { useAtom } from '@/lib/speedscope-core/atom';
import { ArrowLeft, Share2, MessageSquare, Palette, MoreVertical, Check } from 'lucide-react';

interface TraceViewerHeaderActionsProps {
  traceId: string;
  isAuthenticated: boolean;
  onShowComments: () => void;
  onShare: () => void;
  selectedFlamegraphTheme: FlamegraphThemeName;
  onFlamegraphThemeChange: (theme: FlamegraphThemeName) => void;
}

export function TraceViewerHeaderActions({
  traceId,
  isAuthenticated,
  onShowComments,
  onShare,
  selectedFlamegraphTheme,
  onFlamegraphThemeChange,
}: TraceViewerHeaderActionsProps) {
  const backLink = isAuthenticated ? `/traces/${traceId}` : '/';
  const backText = isAuthenticated ? 'Back to Details' : 'Back Home';

  const commonFlamegraphThemeSelector = (
    <>
      {(Object.keys(flamegraphThemeDisplayNames) as FlamegraphThemeName[]).map((themeName) => (
        <SelectItem
          key={themeName}
          value={themeName}
          className="data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground [&_svg]:hidden pl-3"
          onSelect={() => onFlamegraphThemeChange(themeName)}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-4 h-4 rounded-sm border border-border"
              style={
                flamegraphThemePreviews[themeName]
                  ? { background: flamegraphThemePreviews[themeName] }
                  : { backgroundColor: 'transparent' }
              }
              aria-hidden="true"
            />
            <span>{flamegraphThemeDisplayNames[themeName]}</span>
          </div>
        </SelectItem>
      ))}
    </>
  );

  return (
    <>
      {/* Desktop View: lg and up */}
      <div className="hidden lg:flex items-center gap-2">
        <Select value={selectedFlamegraphTheme} onValueChange={onFlamegraphThemeChange}>
          <SelectTrigger
            className="w-[150px] h-8 py-0.5 text-sm bg-background/80 backdrop-blur-sm border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md"
            title="Select Flamegraph Theme"
          >
            <SelectValue placeholder="Select theme..." />
          </SelectTrigger>
          <SelectContent className="bg-background/95 backdrop-blur-lg border-border shadow-xl rounded-xl p-1">
            {commonFlamegraphThemeSelector}
          </SelectContent>
        </Select>

        {isAuthenticated && (
          <Button variant="ghost" size="sm" onClick={onShowComments} title="Show Comments">
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
        {isAuthenticated && (
          <Button variant="ghost" size="sm" onClick={onShare} title="Share Trace">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
        <Link to={backLink} title={backText}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {backText}
          </Button>
        </Link>
      </div>

      {/* Mobile View: hidden on lg and up */}
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden group h-8 w-8"
            >
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <MoreVertical className="h-4 w-4 relative z-10" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-background/95 backdrop-blur-lg border border-border shadow-xl rounded-xl p-2 min-w-[160px]"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex cursor-default select-none items-center rounded-lg px-3 py-1.5 text-sm outline-none transition-all duration-200 hover:bg-background/80 hover:backdrop-blur-sm focus:bg-background/80 focus:text-foreground data-[state=open]:bg-background/80 dark:hover:bg-white/5 hover:bg-black/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30">
                    <Palette className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="font-medium">Theme</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="bg-background/95 backdrop-blur-lg border border-border shadow-xl rounded-xl p-2 min-w-[160px]">
                  {(Object.keys(flamegraphThemeDisplayNames) as FlamegraphThemeName[]).map(
                    (themeName) => (
                      <DropdownMenuItem
                        key={themeName}
                        onClick={() => onFlamegraphThemeChange(themeName)}
                        className={`flex items-center gap-3 ${selectedFlamegraphTheme === themeName ? 'bg-accent/50 hover:bg-accent/60' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-7 h-7 rounded-lg block flex-shrink-0"
                            style={
                              flamegraphThemePreviews[themeName]
                                ? { background: flamegraphThemePreviews[themeName] }
                                : { backgroundColor: '#666666' }
                            }
                            aria-hidden="true"
                          />
                          <span className="font-medium">
                            {flamegraphThemeDisplayNames[themeName]}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {isAuthenticated && (
              <>
                <DropdownMenuItem
                  onClick={onShowComments}
                  icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
                  iconVariant="accent"
                >
                  Comments
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onShare}
                  icon={<Share2 className="h-4 w-4 text-green-500" />}
                  iconVariant="secondary"
                >
                  Share
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              asChild
              icon={<ArrowLeft className="h-4 w-4 text-muted-foreground" />}
              iconVariant="default"
            >
              <Link to={backLink} className="w-full">
                {backText}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

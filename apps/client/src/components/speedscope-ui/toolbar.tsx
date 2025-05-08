import React, { Fragment, useCallback, useState, useEffect } from 'react';
import type { ApplicationProps } from './application';
import { Sizes, FontFamily, FontSize, Duration } from './style';
import { ProfileSelect } from './profile-select';
import type { Profile } from '../../lib/speedscope-core/profile';
import { objectsHaveShallowEquality } from '../../lib/speedscope-core/lib-utils';
import { colorSchemeToString, useTheme, Theme } from './themes/theme';
import { ViewMode } from '../../lib/speedscope-core/view-mode';
import { viewModeAtom } from '../../lib/speedscope-core/app-state';
import type { ProfileGroupState } from '../../lib/speedscope-core/app-state/profile-group';
import { colorSchemeAtom } from '../../lib/speedscope-core/app-state/color-scheme';
import { useAtom } from '../../lib/speedscope-core/atom';

interface ToolbarProps extends ApplicationProps {
  // browseForFile(): void
  // saveFile(): void
}

function useSetViewMode(setViewMode: (viewMode: ViewMode) => void, viewMode: ViewMode) {
  return useCallback(() => setViewMode(viewMode), [setViewMode, viewMode]);
}

// --- Toolbar Button Component (Helper for Tailwind) ---
interface ToolbarButtonProps {
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  isActive?: boolean;
  children: React.ReactNode;
  className?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  isActive,
  children,
  className,
}) => {
  // Base classes + conditional active/hover classes
  const baseClasses =
    'inline-block mt-px h-[calc(theme(height.8)-theme(margin.px))] leading-[calc(theme(height.8)-theme(margin.px))] px-2 ml-0.5 transition-colors ease-in'; // Adjust h-8, leading, ml-0.5 based on Sizes
  const themeClasses = isActive
    ? 'bg-primary text-primary-foreground hover:bg-primary'
    : 'bg-secondary text-secondary-foreground hover:bg-accent'; // Map theme.selectionPrimary/SecondaryColor

  return (
    <div className={`${baseClasses} ${themeClasses} ${className || ''}`} onClick={onClick}>
      {children}
    </div>
  );
};

const EmojiSpan: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block align-middle mr-1">{children}</span> // Approximated style.emoji
);
// --- End Helper Components ---

function ToolbarLeftContent(props: ToolbarProps) {
  const setChronoFlameChart = useSetViewMode(viewModeAtom.set, ViewMode.CHRONO_FLAME_CHART);
  const setLeftHeavyFlameGraph = useSetViewMode(viewModeAtom.set, ViewMode.LEFT_HEAVY_FLAME_GRAPH);
  const setSandwichView = useSetViewMode(viewModeAtom.set, ViewMode.SANDWICH_VIEW);

  if (!props.activeProfileState) return null;

  return (
    <div className="absolute h-8 overflow-hidden top-0 left-0 ml-0.5 text-left">
      <ToolbarButton
        isActive={props.viewMode === ViewMode.CHRONO_FLAME_CHART}
        onClick={setChronoFlameChart}
      >
        <EmojiSpan>🕰</EmojiSpan>Time Order
      </ToolbarButton>
      <ToolbarButton
        isActive={props.viewMode === ViewMode.LEFT_HEAVY_FLAME_GRAPH}
        onClick={setLeftHeavyFlameGraph}
      >
        <EmojiSpan>⬅️</EmojiSpan>Left Heavy
      </ToolbarButton>
      <ToolbarButton isActive={props.viewMode === ViewMode.SANDWICH_VIEW} onClick={setSandwichView}>
        <EmojiSpan>🥪</EmojiSpan>Sandwich
      </ToolbarButton>
    </div>
  );
}

const getCachedProfileList = (() => {
  // TODO(jlfwong): It would be nice to just implement this as useMemo, but if
  // we do that using profileGroup or profileGroup.profiles as the cache key,
  // then it will invalidate whenever *anything* changes, because
  // profileGroup.profiles is ProfileState[], which contains component state
  // information for each tab for each profile. So whenever any property in any
  // persisted view state changes for *any* view in *any* profile, the profiles
  // list will get re-generated.
  let cachedProfileList: Profile[] | null = null;

  return (profileGroup: ProfileGroupState): Profile[] | null => {
    const nextProfileList = profileGroup?.profiles.map((p) => p.profile) || null;

    if (
      cachedProfileList === null ||
      (nextProfileList != null && !objectsHaveShallowEquality(cachedProfileList, nextProfileList))
    ) {
      cachedProfileList = nextProfileList;
    }

    return cachedProfileList;
  };
})();

function ToolbarCenterContent(props: ToolbarProps): JSX.Element {
  const { activeProfileState, profileGroup } = props;
  const profiles = getCachedProfileList(profileGroup);
  const [profileSelectShown, setProfileSelectShown] = useState(false);

  const openProfileSelect = useCallback(() => {
    setProfileSelectShown(true);
  }, [setProfileSelectShown]);

  const closeProfileSelect = useCallback(() => {
    setProfileSelectShown(false);
  }, [setProfileSelectShown]);

  useEffect(() => {
    const onWindowKeyPress = (ev: KeyboardEvent) => {
      if (ev.key === 't') {
        ev.preventDefault();
        setProfileSelectShown(true);
      }
    };
    window.addEventListener('keypress', onWindowKeyPress);
    return () => {
      window.removeEventListener('keypress', onWindowKeyPress);
    };
  }, [setProfileSelectShown]);

  if (activeProfileState && profileGroup && profiles) {
    if (profileGroup.profiles.length === 1) {
      return <>{activeProfileState.profile.getName()}</>;
    } else {
      return (
        <div className="pt-px h-8 relative" onMouseLeave={closeProfileSelect}>
          <span onMouseOver={openProfileSelect}>
            {activeProfileState.profile.getName()}{' '}
            <span className="text-muted-foreground">
              ({activeProfileState.index + 1}/{profileGroup.profiles.length})
            </span>
          </span>
          <div style={{ display: profileSelectShown ? 'block' : 'none' }}>
            <ProfileSelect
              setProfileIndexToView={props.setProfileIndexToView}
              indexToView={profileGroup.indexToView}
              profiles={profiles}
              closeProfileSelect={closeProfileSelect}
              visible={profileSelectShown}
            />
          </div>
        </div>
      );
    }
  }
  return <>{'🔬speedscope'}</>;
}

function ToolbarRightContent(props: ToolbarProps) {
  const colorScheme = useAtom(colorSchemeAtom);

  const colorSchemeToggle = (
    <ToolbarButton onClick={colorSchemeAtom.cycleToNextColorScheme}>
      <EmojiSpan>🎨</EmojiSpan>
      <span className="inline-block text-center min-w-[50px]">
        {colorSchemeToString(colorScheme)}
      </span>
    </ToolbarButton>
  );

  const help = (
    <ToolbarButton className="px-2">
      <a
        href="https://github.com/jlfwong/speedscope#usage"
        className="no-underline text-inherit"
        target="_blank"
        rel="noopener noreferrer"
      >
        <EmojiSpan>❓</EmojiSpan>Help
      </a>
    </ToolbarButton>
  );

  return (
    <div className="absolute h-8 overflow-hidden top-0 right-0 mr-0.5 text-right">
      {colorSchemeToggle}
      {help}
    </div>
  );
}

export function Toolbar(props: ToolbarProps) {
  return (
    <div className="h-8 shrink-0 bg-secondary text-secondary-foreground text-center font-mono text-base leading-[calc(theme(height.8)-theme(margin.px))] select-none">
      <ToolbarLeftContent {...props} />
      <ToolbarCenterContent {...props} />
      <ToolbarRightContent {...props} />
    </div>
  );
}

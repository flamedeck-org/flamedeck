import React, {
  createContext,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  memo,
  Fragment,
} from 'react';
import { ProfileSearchResults } from '../../lib/speedscope-core/profile-search';
import type { Profile } from '../../lib/speedscope-core/profile';
import { useActiveProfileState } from '../../lib/speedscope-core/app-state/active-profile-state';
import { searchIsActiveAtom, searchQueryAtom } from '../../lib/speedscope-core/app-state';
import { useAtom } from '../../lib/speedscope-core/atom';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

function stopPropagation(ev: React.KeyboardEvent | React.MouseEvent) {
  ev.stopPropagation();
}

export const ProfileSearchContext = createContext<ProfileSearchResults | null>(null);

export const ProfileSearchContextProvider = ({ children }: { children: React.ReactNode }) => {
  const activeProfileState = useActiveProfileState();
  const profile: Profile | null = activeProfileState ? activeProfileState.profile : null;
  const searchIsActive = useAtom(searchIsActiveAtom);
  const searchQuery = useAtom(searchQueryAtom);

  const searchResults = useMemo(() => {
    if (!profile || !searchIsActive || searchQuery.length === 0) {
      return null;
    }
    return new ProfileSearchResults(profile, searchQuery);
  }, [searchIsActive, searchQuery, profile]);

  return (
    <ProfileSearchContext.Provider value={searchResults}>{children}</ProfileSearchContext.Provider>
  );
};

interface SearchViewProps {
  resultIndex: number | null;
  numResults: number | null;
  selectNext: () => void;
  selectPrev: () => void;
}

export const SearchView = memo(
  ({ numResults, resultIndex, selectNext, selectPrev }: SearchViewProps) => {
    const searchIsActive = useAtom(searchIsActiveAtom);
    const searchQuery = useAtom(searchQueryAtom);
    const setSearchQuery = searchQueryAtom.set;
    const setSearchIsActive = searchIsActiveAtom.set;

    const onInput = useCallback(
      (ev: React.FormEvent<HTMLInputElement>) => {
        const value = ev.currentTarget.value;
        setSearchQuery(value);
      },
      [setSearchQuery]
    );

    const inputRef = useRef<HTMLInputElement | null>(null);

    const close = useCallback(() => setSearchIsActive(false), [setSearchIsActive]);

    const selectPrevOrNextResult = useCallback(
      (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.shiftKey) {
          selectPrev();
        } else {
          selectNext();
        }
      },
      [selectPrev, selectNext]
    );

    const onKeyDown = useCallback(
      (ev: React.KeyboardEvent<HTMLInputElement>) => {
        stopPropagation(ev);

        if (ev.key === 'Escape') {
          setSearchIsActive(false);
        }

        if (ev.key === 'Enter') {
          selectPrevOrNextResult(ev);
        }

        if (ev.key == 'f' && (ev.metaKey || ev.ctrlKey)) {
          if (inputRef.current) {
            inputRef.current.select();
          }
          ev.preventDefault();
        }
      },
      [setSearchIsActive, selectPrevOrNextResult]
    );

    useEffect(() => {
      const onWindowKeyDown = (ev: KeyboardEvent) => {
        if (ev.key == 'f' && (ev.metaKey || ev.ctrlKey)) {
          ev.preventDefault();
          if (inputRef.current) {
            inputRef.current.select();
          } else {
            setSearchIsActive(true);
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.select();
              }
            });
          }
        }
      };

      window.addEventListener('keydown', onWindowKeyDown);
      return () => {
        window.removeEventListener('keydown', onWindowKeyDown);
      };
    }, [setSearchIsActive]);

    if (!searchIsActive) return null;

    // Override containerBg to force opaque background
    const containerBg = 'bg-gray-100 dark:bg-gray-800'; // Force opaque light/dark gray
    const containerText = 'text-text-alt dark:text-dark-text-alt';
    const containerBorder = 'border-text-alt dark:border-dark-text-alt';
    const inputSelectionBg = 'selection:bg-selection dark:selection:bg-dark-selection';
    const inputSelectionText = 'selection:text-text-alt dark:selection:text-dark-text-alt';
    const iconColor = 'text-text-alt dark:text-dark-text-alt';
    const buttonHoverBg = 'hover:bg-black/10 dark:hover:bg-white/10';
    const resultCountColor = 'text-gray-500 dark:text-gray-400';

    return (
      <div
        className={`absolute top-2.5 right-2.5 h-10 w-80 rounded-md border-2 box-border flex items-center text-xs pl-2 ${containerBg} ${containerText} ${containerBorder}`}
      >
        <span className={`flex-shrink-0 h-full mr-0.5 text-xs flex items-center ${iconColor}`}>
          <Search className="w-4 h-4" />
        </span>
        <span className="flex-shrink flex-grow flex h-full ml-1">
          <input
            className={`w-full h-full border-none bg-transparent text-xs leading-10 focus:border-none focus:outline-none ${containerText} ${inputSelectionBg} ${inputSelectionText}`}
            value={searchQuery}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onKeyUp={stopPropagation}
            onKeyPress={stopPropagation}
            ref={inputRef}
          />
        </span>
        {numResults != null && (
          <span className={`flex items-center h-full ml-auto`}>
            <span className={`align-middle px-2 ${resultCountColor}`}>
              {resultIndex == null ? '?' : resultIndex + 1}/{numResults}
            </span>
            <button
              className={`inline-flex items-center justify-center flex-shrink-0 h-full w-7 rounded-sm p-0 focus:outline-none ${iconColor} ${buttonHoverBg}`}
              onClick={selectPrev}
              aria-label="Previous result"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className={`inline-flex items-center justify-center flex-shrink-0 h-full w-7 rounded-sm p-0 focus:outline-none ${iconColor} ${buttonHoverBg}`}
              onClick={selectNext}
              aria-label="Next result"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </span>
        )}
        <button
          className={`inline-flex items-center justify-center flex-shrink-0 h-full w-7 rounded-sm p-0 text-sm cursor-pointer focus:outline-none ${buttonHoverBg}`}
          onClick={close}
          aria-label="Close search"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }
);

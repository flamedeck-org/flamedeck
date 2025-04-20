import React, { createContext, useCallback, useRef, useEffect, useMemo, memo, Fragment } from 'react';
import { ProfileSearchResults } from '../../lib/speedscope-core/profile-search';
import { Profile } from '../../lib/speedscope-core/profile';
import { useActiveProfileState } from '../../lib/speedscope-core/app-state/active-profile-state';
import { searchIsActiveAtom, searchQueryAtom } from '../../lib/speedscope-core/app-state';
import { useAtom } from '../../lib/speedscope-core/atom';

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

    const onInput = useCallback((ev: React.FormEvent<HTMLInputElement>) => {
      const value = ev.currentTarget.value;
      setSearchQuery(value);
    }, [setSearchQuery]);

    const inputRef = useRef<HTMLInputElement | null>(null);

    const close = useCallback(() => setSearchIsActive(false), [setSearchIsActive]);

    const selectPrevOrNextResult = useCallback((ev: React.KeyboardEvent<HTMLInputElement>) => {
      if (ev.shiftKey) {
        selectPrev();
      } else {
        selectNext();
      }
    }, [selectPrev, selectNext]);

    const onKeyDown = useCallback((ev: React.KeyboardEvent<HTMLInputElement>) => {
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
    }, [setSearchIsActive, selectPrevOrNextResult]);

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

    const altFgSecondaryColor = 'gray';

    return (
      <div className="absolute top-0 right-2.5 h-[30px] w-[208px] border-2 border-black bg-gray-100 text-black text-xs box-border flex items-center">
        <span className="flex-shrink-0 align-middle h-full mx-0.5 text-xs">🔍</span>
        <span className="flex-shrink flex-grow flex">
          <input
            className="w-full border-none bg-none text-xs leading-[30px] text-black focus:border-none focus:outline-none selection:bg-blue-500 selection:text-white"
            value={searchQuery}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onKeyUp={stopPropagation}
            onKeyPress={stopPropagation}
            ref={inputRef}
          />
        </span>
        {numResults != null && (
          <>
            <span className="align-middle">
              {resultIndex == null ? '?' : resultIndex + 1}/{numResults}
            </span>
            <button className="inline-block flex-shrink-0 align-middle h-full mx-0.5 text-xs bg-none border-none p-0 focus:outline-none" onClick={selectPrev}>
              ⬅️
            </button>
            <button className="inline-block flex-shrink-0 align-middle h-full mx-0.5 text-xs bg-none border-none p-0 focus:outline-none" onClick={selectNext}>
              ➡️
            </button>
          </>
        )}
        <svg
          className="flex-shrink-0 align-middle h-full mx-0.5 text-xs cursor-pointer"
          onClick={close}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.99999 4.16217L11.6427 10.8048M11.6427 4.16217L4.99999 10.8048"
            stroke={altFgSecondaryColor}
          />
        </svg>
      </div>
    );
  },
);

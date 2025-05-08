import type { Profile } from "../../lib/speedscope-core/profile";
import type { Ref } from "react";
import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { fuzzyMatchStrings } from "../../lib/speedscope-core/fuzzy-find";
import { sortBy } from "../../lib/speedscope-core/lib-utils";

interface ProfileSelectRowProps {
  setProfileIndexToView: (profileIndex: number) => void;
  setHoveredProfileIndex: (profileIndex: number) => void;
  profile: Profile;
  matchedRanges: [number, number][];
  hovered: boolean;
  selected: boolean;
  indexInProfileGroup: number;
  indexInFilteredListView: number;
  profileCount: number;
  nodeRef?: Ref<HTMLDivElement>;
  closeProfileSelect: () => void;
}

function highlightRanges(
  text: string,
  ranges: [number, number][],
  highlightedClassName: string
): JSX.Element {
  const spans: ComponentChild[] = [];
  let last = 0;
  for (const range of ranges) {
    spans.push(text.slice(last, range[0]));
    spans.push(<span className={highlightedClassName}>{text.slice(range[0], range[1])}</span>);
    last = range[1];
  }
  spans.push(text.slice(last));

  return <span>{spans}</span>;
}

export function ProfileSelectRow({
  setProfileIndexToView,
  setHoveredProfileIndex,
  profile,
  selected,
  hovered,
  profileCount,
  nodeRef,
  closeProfileSelect,
  indexInProfileGroup,
  matchedRanges,
  indexInFilteredListView,
}: ProfileSelectRowProps) {
  const onMouseUp = useCallback(() => {
    closeProfileSelect();
    setProfileIndexToView(indexInProfileGroup);
  }, [closeProfileSelect, setProfileIndexToView, indexInProfileGroup]);

  const onMouseEnter = useCallback(
    (ev: Event) => {
      setHoveredProfileIndex(indexInProfileGroup);
    },
    [setHoveredProfileIndex, indexInProfileGroup]
  );

  const name = profile.getName();

  const maxDigits = 1 + Math.floor(Math.log10(profileCount));

  const highlightedClassName = "bg-yellow-200 text-black";
  const highlighted = useMemo(() => {
    const result = highlightRanges(name, matchedRanges, highlightedClassName);
    return result;
  }, [name, matchedRanges, highlightedClassName]);

  const rowClasses = [
    "h-[28px]",
    "border border-transparent",
    "text-left",
    "px-2.5",
    "bg-white",
    "overflow-hidden whitespace-nowrap text-ellipsis",
    "cursor-pointer",
    indexInFilteredListView % 2 === 0 ? "bg-gray-100" : "",
    selected ? "bg-blue-500 text-white" : "",
    hovered ? "border-blue-500" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const indexClasses = ["inline-block text-right", "text-gray-500", selected ? "text-white" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={nodeRef}
      onMouseUp={onMouseUp}
      onMouseEnter={onMouseEnter}
      title={name}
      className={rowClasses}
    >
      <span className={indexClasses} style={{ width: maxDigits + "em" }}>
        {indexInProfileGroup + 1}:
      </span>{" "}
      {highlighted}
    </div>
  );
}

interface ProfileSelectProps {
  setProfileIndexToView: (profileIndex: number) => void;
  indexToView: number;
  profiles: Profile[];
  closeProfileSelect: () => void;
  visible: boolean;
}

function stopPropagation(ev: Event) {
  ev.stopPropagation();
}

interface FilteredProfile {
  indexInProfileGroup: number;
  profile: Profile;
  matchedRanges: [number, number][];
  score: number;
}

function getSortedFilteredProfiles(profiles: Profile[], filterText: string): FilteredProfile[] {
  const filtered: FilteredProfile[] = [];
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    const match = fuzzyMatchStrings(profile.getName(), filterText);
    if (!match) continue;
    filtered.push({
      indexInProfileGroup: i,
      profile,
      ...match,
    });
  }
  sortBy(filtered, (p) => -p.score);
  return filtered;
}

export function ProfileSelect({
  profiles,
  closeProfileSelect,
  indexToView,
  visible,
  setProfileIndexToView,
}: ProfileSelectProps) {
  const [filterText, setFilterText] = useState("");

  const onFilterTextChange = useCallback(
    (ev: Event) => {
      const value = (ev.target as HTMLInputElement).value;
      setFilterText(value);
    },
    [setFilterText]
  );

  const focusFilterInput = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) {
        if (visible) {
          node.select();
        } else {
          node.blur();
        }
      }
    },
    [visible]
  );

  const filteredProfiles = useMemo(() => {
    return getSortedFilteredProfiles(profiles, filterText);
  }, [profiles, filterText]);

  const [hoveredProfileIndex, setHoveredProfileIndex] = useState<number | null>(0);

  const selectedNodeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (visible) {
      setHoveredProfileIndex(null);
      if (selectedNodeRef.current !== null) {
        selectedNodeRef.current.scrollIntoView({
          behavior: "auto",
          block: "nearest",
          inline: "nearest",
        });
      }
    }
  }, [visible]);

  const onFilterKeyUp = useCallback(
    (ev: KeyboardEvent) => {
      stopPropagation(ev);

      let newHoveredIndexInFilteredList: number | null = null;

      switch (ev.key) {
        case "Enter": {
          if (hoveredProfileIndex != null) {
            closeProfileSelect();
            setProfileIndexToView(hoveredProfileIndex);
          }
          break;
        }
        case "Escape": {
          closeProfileSelect();
          break;
        }
        case "ArrowDown": {
          ev.preventDefault();
          newHoveredIndexInFilteredList = 0;
          if (hoveredProfileIndex != null) {
            const indexInFilteredList = filteredProfiles.findIndex(
              (p) => p.indexInProfileGroup === hoveredProfileIndex
            );
            if (indexInFilteredList !== -1) {
              newHoveredIndexInFilteredList = indexInFilteredList + 1;
            }
          }
          break;
        }
        case "ArrowUp": {
          ev.preventDefault();
          newHoveredIndexInFilteredList = filteredProfiles.length - 1;
          if (hoveredProfileIndex != null) {
            const indexInFilteredList = filteredProfiles.findIndex(
              (p) => p.indexInProfileGroup === hoveredProfileIndex
            );
            if (indexInFilteredList !== -1) {
              newHoveredIndexInFilteredList = indexInFilteredList - 1;
            }
          }
          break;
        }
      }

      if (
        newHoveredIndexInFilteredList != null &&
        newHoveredIndexInFilteredList >= 0 &&
        newHoveredIndexInFilteredList < filteredProfiles.length
      ) {
        const indexInProfileGroup =
          filteredProfiles[newHoveredIndexInFilteredList].indexInProfileGroup;
        setHoveredProfileIndex(indexInProfileGroup);
        setPendingForcedScroll(true);
      }
    },
    [closeProfileSelect, setProfileIndexToView, hoveredProfileIndex, filteredProfiles]
  );

  const [pendingForcedScroll, setPendingForcedScroll] = useState(false);
  useEffect(() => {
    if (filteredProfiles.length > 0) {
      setHoveredProfileIndex(filteredProfiles[0].indexInProfileGroup);
      setPendingForcedScroll(true);
    }
  }, [setHoveredProfileIndex, filteredProfiles]);

  const hoveredNodeRef = useCallback(
    (hoveredNode: HTMLDivElement | null) => {
      if (pendingForcedScroll && hoveredNode) {
        hoveredNode.scrollIntoView({
          behavior: "auto",
          block: "nearest",
          inline: "nearest",
        });
        setPendingForcedScroll(false);
      }
    },
    [pendingForcedScroll, setPendingForcedScroll]
  );

  const selectedHoveredRef = useCallback(
    (node: HTMLDivElement | null) => {
      selectedNodeRef.current = node;
      hoveredNodeRef(node);
    },
    [selectedNodeRef, hoveredNodeRef]
  );

  return (
    <div className="w-full max-w-lg mx-auto relative z-20 flex flex-col items-center">
      <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-black"></div>
      <div className="w-full pb-2.5 bg-white text-black">
        <div className="flex flex-col p-1.25 items-stretch">
          <input
            type="text"
            className="text-black bg-gray-100 rounded p-1.25 border-none outline-none focus:border-none focus:outline-none selection:bg-blue-300 selection:text-black"
            ref={focusFilterInput}
            placeholder={"Filter..."}
            value={filterText}
            onInput={onFilterTextChange}
            onKeyDown={onFilterKeyUp}
            onKeyUp={stopPropagation}
            onKeyPress={stopPropagation}
          />
        </div>
        <div className="max-h-[calc(min(100vh-64px,560px))] overflow-auto">
          {filteredProfiles.map(({ profile, matchedRanges, indexInProfileGroup }, indexInList) => {
            let ref: Ref<HTMLDivElement> | undefined = undefined;
            const selected = indexInProfileGroup === indexToView;
            const hovered = indexInProfileGroup === hoveredProfileIndex;
            if (selected && hovered) {
              ref = selectedHoveredRef;
            } else if (selected) {
              ref = selectedNodeRef;
            } else if (hovered) {
              ref = hoveredNodeRef;
            }
            return (
              <ProfileSelectRow
                key={indexInProfileGroup}
                setHoveredProfileIndex={setHoveredProfileIndex}
                indexInProfileGroup={indexInProfileGroup}
                indexInFilteredListView={indexInList}
                hovered={hovered}
                selected={selected}
                profile={profile}
                profileCount={profiles.length}
                nodeRef={ref}
                matchedRanges={matchedRanges}
                setProfileIndexToView={setProfileIndexToView}
                closeProfileSelect={closeProfileSelect}
              />
            );
          })}
          {filteredProfiles.length === 0 ? (
            <div className="h-[28px] border border-transparent text-left px-2.5 bg-white overflow-hidden whitespace-nowrap text-ellipsis">
              No results match filter "{filterText}"
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

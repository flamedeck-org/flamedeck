import React, { memo, useCallback, useMemo, useContext } from "react";
import type { Profile, Frame } from "../../lib/speedscope-core/profile";
import { formatPercent } from "../../lib/speedscope-core/lib-utils";
import { ColorChit } from "./color-chit";
import type { ListItem } from "./scrollable-list-view";
import { ScrollableListView } from "./scrollable-list-view";
import {
  createGetCSSColorForFrame,
  getFrameToColorBucket,
} from "../../lib/speedscope-core/app-state/getters";
import { SandwichViewContext } from "./sandwich-view";
import { Color } from "../../lib/speedscope-core/color";
import type { SortMethod } from "../../lib/speedscope-core/app-state";
import {
  SortDirection,
  SortField,
  profileGroupAtom,
  tableSortMethodAtom,
  searchIsActiveAtom,
  searchQueryAtom,
} from "../../lib/speedscope-core/app-state";
import { useAtom } from "../../lib/speedscope-core/atom";
import type { ActiveProfileState } from "../../lib/speedscope-core/app-state/active-profile-state";
import { useTheme } from "./themes/theme";

interface HBarProps {
  perc: number;
}

function HBarDisplay(props: HBarProps) {
  const hBarBgColorClass = "bg-gray-200 dark:bg-gray-700";
  const hBarFillColorClass = "bg-primary";

  return (
    <div className={`relative w-full h-full ${hBarBgColorClass}`}>
      <div
        className={`absolute top-0 right-0 h-full ${hBarFillColorClass}`}
        style={{ width: `${props.perc}%` }}
      />
    </div>
  );
}

interface SortIconProps {
  activeDirection: SortDirection | null;
}

function SortIcon(props: SortIconProps) {
  const activeClass = "text-text dark:text-dark-text";
  const inactiveClass = "text-text-secondary dark:text-dark-text-secondary";

  const { activeDirection } = props;
  const upColorClass = activeDirection === SortDirection.ASCENDING ? activeClass : inactiveClass;
  const downColorClass = activeDirection === SortDirection.DESCENDING ? activeClass : inactiveClass;

  return (
    <svg
      width="8"
      height="10"
      viewBox="0 0 8 10"
      xmlns="http://www.w3.org/2000/svg"
      className={`mr-1.5 inline-block ${upColorClass}`}
    >
      <path d="M0 4L4 0L8 4H0Z" fill="currentColor" />
      <path
        d="M0 4L4 0L8 4H0Z"
        transform="translate(0 10) scale(1 -1)"
        fill="currentColor"
        className={downColorClass}
      />
    </svg>
  );
}

interface ProfileTableRowViewProps {
  frame: Frame;
  matchedRanges: [number, number][] | null;
  index: number;
  profile: Profile;
  selectedFrame: Frame | null;
  setSelectedFrame: (f: Frame) => void;
  getCSSColorForFrame: (frame: Frame) => string;
}

function highlightRanges(
  text: string,
  ranges: [number, number][],
  highlightedClassName: string
): React.ReactElement {
  const spans: React.ReactNode[] = [];
  let last = 0;
  for (const range of ranges) {
    spans.push(text.slice(last, range[0]));
    spans.push(<span className={highlightedClassName}>{text.slice(range[0], range[1])}</span>);
    last = range[1];
  }
  spans.push(text.slice(last));

  return <span>{spans}</span>;
}

const ProfileTableRowView = ({
  frame,
  matchedRanges,
  profile,
  index,
  selectedFrame,
  setSelectedFrame,
  getCSSColorForFrame,
}: ProfileTableRowViewProps) => {
  const totalWeight = frame.getTotalWeight();
  const selfWeight = frame.getSelfWeight();
  const totalPerc = (100.0 * totalWeight) / profile.getTotalNonIdleWeight();
  const selfPerc = (100.0 * selfWeight) / profile.getTotalNonIdleWeight();

  const selected = frame === selectedFrame;

  // Base classes applied to all rows
  const baseClasses = [
    "h-[30px]",
    "text-text dark:text-dark-text",
    "font-mono",
    "relative",
    "cursor-pointer",
    "transition-colors duration-100",
  ];

  // Determine specific classes based on selected state and index
  let specificClasses: string[];
  if (selected) {
    // Selected rows use accent colors
    specificClasses = ["bg-accent text-accent-foreground"];
  } else {
    // Non-selected rows get alternating background + hover using theme colors
    // Use bg-muted for odd rows for a more subtle stripe
    const bgClass = index % 2 === 0 ? "bg-background dark:bg-background" : "bg-muted dark:bg-muted"; // Use muted instead of secondary
    specificClasses = [bgClass, "hover:bg-accent/20 dark:hover:bg-accent/20"]; // Use accent for hover for better visibility
  }

  // Combine base and specific classes
  const rowClasses = [...baseClasses, ...specificClasses];

  const matchedBaseClass = "bg-highlight dark:bg-dark-highlight rounded-[1px] px-0.5";
  const matchedSelectedClass = "bg-primary text-primary-foreground rounded-[1px] px-0.5";
  const matchedClassName = selected ? matchedSelectedClass : matchedBaseClass;

  const baseNumericCellClass =
    "relative text-ellipsis overflow-hidden whitespace-nowrap text-right w-[180px] min-w-[180px] align-top pt-1";
  const totalCellClass = `${baseNumericCellClass} pl-2 pr-2`;
  const selfCellClass = `${baseNumericCellClass} pl-4 pr-[30px]`;
  const textCellBaseClass =
    "text-ellipsis overflow-hidden whitespace-nowrap w-full max-w-0 align-top pt-1 pl-1";

  return (
    <tr key={`${index}`} onClick={() => setSelectedFrame(frame)} className={rowClasses.join(" ")}>
      <td className={totalCellClass}>
        {profile.formatValue(totalWeight)} ({formatPercent(totalPerc)})
        <div className="absolute bottom-0 left-4 right-4 h-0.5">
          <HBarDisplay perc={totalPerc} />
        </div>
      </td>
      <td className={selfCellClass}>
        {profile.formatValue(selfWeight)} ({formatPercent(selfPerc)})
        <div className="absolute bottom-0 left-4 right-[34px] h-0.5">
          <HBarDisplay perc={selfPerc} />
        </div>
      </td>
      <td title={frame.file} className={textCellBaseClass}>
        <ColorChit color={getCSSColorForFrame(frame)} />
        {matchedRanges ? highlightRanges(frame.name, matchedRanges, matchedClassName) : frame.name}
      </td>
    </tr>
  );
};

interface ProfileTableViewProps {
  profile: Profile;
  selectedFrame: Frame | null;
  getCSSColorForFrame: (frame: Frame) => string;
  sortMethod: SortMethod;
  setSelectedFrame: (frame: Frame | null) => void;
  setSortMethod: (sortMethod: SortMethod) => void;
  searchQuery: string;
  searchIsActive: boolean;
}

export const ProfileTableView = memo(
  ({
    profile,
    sortMethod,
    setSortMethod,
    selectedFrame,
    setSelectedFrame,
    getCSSColorForFrame,
    searchQuery,
    searchIsActive,
  }: ProfileTableViewProps) => {
    const onSortClick = useCallback(
      (field: SortField, ev: React.MouseEvent) => {
        ev.preventDefault();

        if (sortMethod.field == field) {
          setSortMethod({
            field,
            direction:
              sortMethod.direction === SortDirection.ASCENDING
                ? SortDirection.DESCENDING
                : SortDirection.ASCENDING,
          });
        } else {
          switch (field) {
            case SortField.SYMBOL_NAME: {
              setSortMethod({ field, direction: SortDirection.ASCENDING });
              break;
            }
            case SortField.SELF: {
              setSortMethod({ field, direction: SortDirection.DESCENDING });
              break;
            }
            case SortField.TOTAL: {
              setSortMethod({ field, direction: SortDirection.DESCENDING });
              break;
            }
          }
        }
      },
      [sortMethod, setSortMethod]
    );

    const sandwichContext = useContext(SandwichViewContext);

    const renderItems = useCallback(
      (firstIndex: number, lastIndex: number): React.ReactElement | null => {
        if (!sandwichContext) return null;

        const rows: React.ReactElement[] = [];

        for (let i = firstIndex; i <= lastIndex; i++) {
          const frame = sandwichContext.rowList[i];
          const match = sandwichContext.getSearchMatchForFrame(frame);
          rows.push(
            <ProfileTableRowView
              key={i}
              frame={frame}
              matchedRanges={match == null ? null : match}
              index={i}
              profile={profile}
              selectedFrame={selectedFrame}
              setSelectedFrame={setSelectedFrame}
              getCSSColorForFrame={getCSSColorForFrame}
            />
          );
        }

        const emptyStateClass = "p-2 text-center font-bold text-text dark:text-dark-text";

        if (rows.length === 0) {
          if (searchIsActive) {
            rows.push(
              <tr key="empty-search">
                <td colSpan={3} className={emptyStateClass}>
                  No symbol names match query "{searchQuery}".
                </td>
              </tr>
            );
          } else {
            rows.push(
              <tr key="empty-nosymbols">
                <td colSpan={3} className={emptyStateClass}>
                  No symbols found.
                </td>
              </tr>
            );
          }
        }

        return (
          <tbody className="w-full text-[10px] bg-background dark:bg-dark-background">{rows}</tbody>
        );
      },
      [
        sandwichContext,
        profile,
        selectedFrame,
        setSelectedFrame,
        getCSSColorForFrame,
        searchIsActive,
        searchQuery,
      ]
    );

    const listItems: ListItem[] = useMemo(
      () => (sandwichContext == null ? [] : sandwichContext.rowList.map((f) => ({ size: 30 }))),
      [sandwichContext]
    );

    const onTotalClick = useCallback(
      (ev: React.MouseEvent) => onSortClick(SortField.TOTAL, ev),
      [onSortClick]
    );
    const onSelfClick = useCallback(
      (ev: React.MouseEvent) => onSortClick(SortField.SELF, ev),
      [onSortClick]
    );
    const onSymbolNameClick = useCallback(
      (ev: React.MouseEvent) => onSortClick(SortField.SYMBOL_NAME, ev),
      [onSortClick]
    );

    const baseNumericHeaderCellClass =
      "p-1 w-[180px] min-w-[180px] text-right text-ellipsis overflow-hidden whitespace-nowrap font-semibold text-text dark:text-dark-text font-mono";
    const totalHeaderCellClass = `${baseNumericHeaderCellClass} pr-2`;
    const selfHeaderCellClass = `${baseNumericHeaderCellClass} pr-[30px]`;

    const textHeaderCellClass =
      "p-1 w-full max-w-0 text-ellipsis overflow-hidden whitespace-nowrap font-semibold text-text dark:text-dark-text font-mono";
    const headerFlexContainerClass = "flex items-center cursor-pointer";
    const numericHeaderFlexContainerClass = `${headerFlexContainerClass} justify-end`;

    return (
      <div className="flex h-full flex-col bg-background dark:bg-dark-background">
        <table className="w-full table-fixed text-[10px]">
          <thead className="select-none border-b-2 border-background-secondary dark:border-dark-background-secondary text-left">
            <tr>
              <th className={totalHeaderCellClass}>
                <div className={numericHeaderFlexContainerClass} onClick={onTotalClick}>
                  <SortIcon
                    activeDirection={
                      sortMethod.field === SortField.TOTAL ? sortMethod.direction : null
                    }
                  />
                  Total
                </div>
              </th>
              <th className={selfHeaderCellClass}>
                <div className={numericHeaderFlexContainerClass} onClick={onSelfClick}>
                  <SortIcon
                    activeDirection={
                      sortMethod.field === SortField.SELF ? sortMethod.direction : null
                    }
                  />
                  Self
                </div>
              </th>
              <th className={textHeaderCellClass}>
                <div className={headerFlexContainerClass} onClick={onSymbolNameClick}>
                  <SortIcon
                    activeDirection={
                      sortMethod.field === SortField.SYMBOL_NAME ? sortMethod.direction : null
                    }
                  />
                  Symbol Name
                </div>
              </th>
            </tr>
          </thead>
        </table>
        <ScrollableListView
          axis={"y"}
          items={listItems}
          className="flex-grow overflow-y-auto overflow-x-hidden bg-background dark:bg-dark-background"
          renderItems={renderItems}
          initialIndexInView={
            selectedFrame == null ? null : sandwichContext?.getIndexForFrame(selectedFrame)
          }
        />
      </div>
    );
  }
);

interface ProfileTableViewContainerProps {
  activeProfileState: ActiveProfileState;
}

export const ProfileTableViewContainer = memo((ownProps: ProfileTableViewContainerProps) => {
  const { activeProfileState } = ownProps;
  const { profile, sandwichViewState } = activeProfileState;
  const theme = useTheme();
  if (!profile) throw new Error("profile missing");
  const tableSortMethod = useAtom(tableSortMethodAtom);
  const { callerCallee } = sandwichViewState;
  const selectedFrame = callerCallee ? callerCallee.selectedFrame : null;
  const frameToColorBucket = getFrameToColorBucket(profile);
  const getCSSColorForFrame = createGetCSSColorForFrame({ theme, frameToColorBucket });

  const setSelectedFrame = useCallback((selectedFrame: Frame | null) => {
    profileGroupAtom.setSelectedFrame(selectedFrame);
  }, []);
  const searchIsActive = useAtom(searchIsActiveAtom);
  const searchQuery = useAtom(searchQueryAtom);

  return (
    <ProfileTableView
      profile={profile}
      selectedFrame={selectedFrame}
      getCSSColorForFrame={getCSSColorForFrame}
      sortMethod={tableSortMethod}
      setSelectedFrame={setSelectedFrame}
      setSortMethod={tableSortMethodAtom.set}
      searchIsActive={searchIsActive}
      searchQuery={searchQuery}
    />
  );
});

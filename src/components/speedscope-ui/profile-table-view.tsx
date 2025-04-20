import React, { memo, useCallback, useMemo, useContext } from 'react'
import { Profile, Frame } from '../../lib/speedscope-core/profile'
import { formatPercent } from '../../lib/speedscope-core/lib-utils'
import { ColorChit } from './color-chit'
import { ListItem, ScrollableListView } from './scrollable-list-view'
import { createGetCSSColorForFrame, getFrameToColorBucket } from '../../lib/speedscope-core/app-state/getters'
import { SandwichViewContext } from './sandwich-view'
import { Color } from '../../lib/speedscope-core/color'
import {
  SortDirection,
  SortMethod,
  SortField,
  profileGroupAtom,
  tableSortMethodAtom,
  searchIsActiveAtom,
  searchQueryAtom,
} from '../../lib/speedscope-core/app-state'
import { useAtom } from '../../lib/speedscope-core/atom'
import { ActiveProfileState } from '../../lib/speedscope-core/app-state/active-profile-state'

interface HBarProps {
  perc: number
}

function HBarDisplay(props: HBarProps) {
  const hBarBgColor = 'rgba(128, 128, 128, 0.2)'
  const hBarFillColor = 'gray'

  return (
    <div
      className="absolute bottom-0.5 h-0.5 right-[30px] w-[calc(100%-60px)]"
      style={{ backgroundColor: hBarBgColor }}
    >
      <div
        className="absolute h-full right-0"
        style={{ width: `${props.perc}%`, backgroundColor: hBarFillColor }}
      />
    </div>
  )
}

interface SortIconProps {
  activeDirection: SortDirection | null
}

function SortIcon(props: SortIconProps) {
  const primaryColor = 'black'
  const secondaryColor = 'gray'

  const { activeDirection } = props
  const upFill = activeDirection === SortDirection.ASCENDING ? primaryColor : secondaryColor
  const downFill = activeDirection === SortDirection.DESCENDING ? primaryColor : secondaryColor

  return (
    <svg
      width="8"
      height="10"
      viewBox="0 0 8 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="relative top-px mr-1.5 inline-block"
    >
      <path d="M0 4L4 0L8 4H0Z" fill={upFill} />
      <path d="M0 4L4 0L8 4H0Z" transform="translate(0 10) scale(1 -1)" fill={downFill} />
    </svg>
  )
}

interface ProfileTableRowViewProps {
  frame: Frame
  matchedRanges: [number, number][] | null
  index: number
  profile: Profile
  selectedFrame: Frame | null
  setSelectedFrame: (f: Frame) => void
  getCSSColorForFrame: (frame: Frame) => string
}

function highlightRanges(
  text: string,
  ranges: [number, number][],
  highlightedClassName: string,
): React.ReactElement {
  const spans: React.ReactNode[] = []
  let last = 0
  for (let range of ranges) {
    spans.push(text.slice(last, range[0]))
    spans.push(<span className={highlightedClassName}>{text.slice(range[0], range[1])}</span>)
    last = range[1]
  }
  spans.push(text.slice(last))

  return <span>{spans}</span>
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
  const totalWeight = frame.getTotalWeight()
  const selfWeight = frame.getSelfWeight()
  const totalPerc = (100.0 * totalWeight) / profile.getTotalNonIdleWeight()
  const selfPerc = (100.0 * selfWeight) / profile.getTotalNonIdleWeight()

  const selected = frame === selectedFrame

  let rowClasses = ['h-[30px]']
  if (index % 2 === 0) {
    rowClasses.push('bg-gray-100')
  } else {
    rowClasses.push('bg-white')
  }
  if (selected) {
    rowClasses = ['h-[30px]', 'bg-blue-500 text-white']
  }

  const matchedBaseClass = 'border-b-2 border-black'
  const matchedSelectedClass = 'border-b-2 border-white'
  const matchedClassName = selected ? matchedSelectedClass : matchedBaseClass

  return (
    <tr
      key={`${index}`}
      onClick={() => setSelectedFrame(frame)}
      className={rowClasses.join(' ')}
    >
      <td className="relative text-ellipsis overflow-hidden whitespace-nowrap text-right pr-[30px] w-[180px] min-w-[180px]">
        {profile.formatValue(totalWeight)} ({formatPercent(totalPerc)})
        <HBarDisplay perc={totalPerc} />
      </td>
      <td className="relative text-ellipsis overflow-hidden whitespace-nowrap text-right pr-[30px] w-[180px] min-w-[180px]">
        {profile.formatValue(selfWeight)} ({formatPercent(selfPerc)})
        <HBarDisplay perc={selfPerc} />
      </td>
      <td title={frame.file} className="text-ellipsis overflow-hidden whitespace-nowrap w-full max-w-0">
        <ColorChit color={getCSSColorForFrame(frame)} />
        {matchedRanges
          ? highlightRanges(
              frame.name,
              matchedRanges,
              matchedClassName,
            )
          : frame.name}
      </td>
    </tr>
  )
}

interface ProfileTableViewProps {
  profile: Profile
  selectedFrame: Frame | null
  getCSSColorForFrame: (frame: Frame) => string
  sortMethod: SortMethod
  setSelectedFrame: (frame: Frame | null) => void
  setSortMethod: (sortMethod: SortMethod) => void
  searchQuery: string
  searchIsActive: boolean
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
        ev.preventDefault()

        if (sortMethod.field == field) {
          setSortMethod({
            field,
            direction:
              sortMethod.direction === SortDirection.ASCENDING
                ? SortDirection.DESCENDING
                : SortDirection.ASCENDING,
          })
        } else {
          switch (field) {
            case SortField.SYMBOL_NAME: {
              setSortMethod({ field, direction: SortDirection.ASCENDING })
              break
            }
            case SortField.SELF: {
              setSortMethod({ field, direction: SortDirection.DESCENDING })
              break
            }
            case SortField.TOTAL: {
              setSortMethod({ field, direction: SortDirection.DESCENDING })
              break
            }
          }
        }
      },
      [sortMethod, setSortMethod],
    )

    const sandwichContext = useContext(SandwichViewContext)

    const renderItems = useCallback(
      (firstIndex: number, lastIndex: number): React.ReactElement | null => {
        if (!sandwichContext) return null

        const rows: React.ReactElement[] = []

        for (let i = firstIndex; i <= lastIndex; i++) {
          const frame = sandwichContext.rowList[i]
          const match = sandwichContext.getSearchMatchForFrame(frame)
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
            />,
          )
        }

        const emptyStateClass = 'text-center font-bold p-2'

        if (rows.length === 0) {
          if (searchIsActive) {
            rows.push(
              <tr key="empty-search">
                <td colSpan={3} className={emptyStateClass}>
                  No symbol names match query "{searchQuery}".
                </td>
              </tr>,
            )
          } else {
            rows.push(
              <tr key="empty-nosymbols">
                <td colSpan={3} className={emptyStateClass}>
                  No symbols found.
                </td>
              </tr>,
            )
          }
        }

        return <tbody className="w-full text-xs bg-white">{rows}</tbody>
      },
      [
        sandwichContext,
        profile,
        selectedFrame,
        setSelectedFrame,
        getCSSColorForFrame,
        searchIsActive,
        searchQuery,
      ],
    )

    const listItems: ListItem[] = useMemo(
      () =>
        sandwichContext == null
          ? []
          : sandwichContext.rowList.map(f => ({ size: 30 })),
      [sandwichContext],
    )

    const onTotalClick = useCallback((ev: React.MouseEvent) => onSortClick(SortField.TOTAL, ev), [onSortClick])
    const onSelfClick = useCallback((ev: React.MouseEvent) => onSortClick(SortField.SELF, ev), [onSortClick])
    const onSymbolNameClick = useCallback((ev: React.MouseEvent) => onSortClick(SortField.SYMBOL_NAME, ev), [onSortClick])

    const numericCellClass = 'relative text-ellipsis overflow-hidden whitespace-nowrap text-right pr-[30px] w-[180px] min-w-[180px] p-1'
    const textCellClass = 'text-ellipsis overflow-hidden whitespace-nowrap w-full max-w-0 p-1'

    return (
      <div className="flex flex-col bg-white h-full">
        <table className="w-full text-xs table-fixed">
          <thead className="border-b-2 border-gray-200 text-left text-black select-none">
            <tr>
              <th className={numericCellClass} onClick={onTotalClick}>
                <SortIcon
                  activeDirection={
                    sortMethod.field === SortField.TOTAL ? sortMethod.direction : null
                  }
                />
                Total
              </th>
              <th className={numericCellClass} onClick={onSelfClick}>
                <SortIcon
                  activeDirection={
                    sortMethod.field === SortField.SELF ? sortMethod.direction : null
                  }
                />
                Self
              </th>
              <th className={textCellClass} onClick={onSymbolNameClick}>
                <SortIcon
                  activeDirection={
                    sortMethod.field === SortField.SYMBOL_NAME ? sortMethod.direction : null
                  }
                />
                Symbol Name
              </th>
            </tr>
          </thead>
        </table>
        <ScrollableListView
          axis={'y'}
          items={listItems}
          className="overflow-y-auto overflow-x-hidden flex-grow"
          renderItems={renderItems}
          initialIndexInView={
            selectedFrame == null ? null : sandwichContext?.getIndexForFrame(selectedFrame)
          }
        />
      </div>
    )
  },
)

interface ProfileTableViewContainerProps {
  activeProfileState: ActiveProfileState
}

export const ProfileTableViewContainer = memo((ownProps: ProfileTableViewContainerProps) => {
  const { activeProfileState } = ownProps
  const { profile, sandwichViewState } = activeProfileState
  if (!profile) throw new Error('profile missing')
  const tableSortMethod = useAtom(tableSortMethodAtom)
  const { callerCallee } = sandwichViewState
  const selectedFrame = callerCallee ? callerCallee.selectedFrame : null
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getCSSColorForFrame = createGetCSSColorForFrame({ frameToColorBucket })

  const setSelectedFrame = useCallback((selectedFrame: Frame | null) => {
    profileGroupAtom.setSelectedFrame(selectedFrame)
  }, [])
  const searchIsActive = useAtom(searchIsActiveAtom)
  const searchQuery = useAtom(searchQueryAtom)

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
  )
})

import {Frame} from '../../lib/speedscope-core/profile'
import {ProfileTableViewContainer} from './profile-table-view'
import React, { JSX, createContext, memo, useCallback, useMemo, useContext, Component } from 'react'
import {commonStyle, Sizes, FontSize} from './style'
import {InvertedCallerFlamegraphView} from './inverted-caller-flamegraph-view'
import {CalleeFlamegraphView} from './callee-flamegraph-view'
import {SandwichSearchView} from './sandwich-search-view'
import {ActiveProfileState} from '../../lib/speedscope-core/app-state/active-profile-state'
import {sortBy} from '../../lib/speedscope-core/lib-utils'
import {ProfileSearchContext} from './search-view'
import {Theme, useTheme} from './themes/theme'
import {SortField, SortDirection, profileGroupAtom, tableSortMethodAtom} from '../../lib/speedscope-core/app-state'
import {useAtom} from '../../lib/speedscope-core/atom'

interface SandwichViewProps {
  selectedFrame: Frame | null
  profileIndex: number
  theme: Theme
  activeProfileState: ActiveProfileState
  setSelectedFrame: (selectedFrame: Frame | null) => void
  glCanvas: HTMLCanvasElement
}

class SandwichView extends Component<SandwichViewProps> {
  private setSelectedFrame = (selectedFrame: Frame | null) => {
    this.props.setSelectedFrame(selectedFrame)
  }

  onWindowKeyPress = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      this.setSelectedFrame(null)
    }
  }

  componentDidMount() {
    window.addEventListener('keydown', this.onWindowKeyPress)
  }
  componentWillUnmount() {
    window.removeEventListener('keydown', this.onWindowKeyPress)
  }

  render() {
    const {selectedFrame} = this.props
    let flamegraphViews: JSX.Element | null = null

    if (selectedFrame) {
      flamegraphViews = (
        <div className="flex-1 border-l border-l-border flex flex-col">
          <div className="flex-1 flex flex-row relative">
            <div className="flex flex-col justify-end items-start text-sm w-[1.2em] border-r border-r-border shrink-0">
              <div className="w-[1.2em] shrink-1 transform -rotate-90 origin-center">Callers</div>
            </div>
            <InvertedCallerFlamegraphView
              glCanvas={this.props.glCanvas}
              activeProfileState={this.props.activeProfileState}
            />
          </div>
          <div className="h-0.5 bg-border" />
          <div className="flex-1 flex flex-row relative">
            <div className="flex flex-col justify-start items-start text-sm w-[1.2em] border-r border-r-border shrink-0">
              <div className="w-[1.2em] shrink-1 transform -rotate-90 origin-center flex justify-end">Callees</div>
            </div>
            <CalleeFlamegraphView
              glCanvas={this.props.glCanvas}
              activeProfileState={this.props.activeProfileState}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-row h-full">
        <div className="relative flex-1">
          <ProfileTableViewContainer activeProfileState={this.props.activeProfileState} />
          <SandwichSearchView />
        </div>
        {flamegraphViews}
      </div>
    )
  }
}

interface SandwichViewContainerProps {
  activeProfileState: ActiveProfileState
  glCanvas: HTMLCanvasElement
}

interface SandwichViewContextData {
  rowList: Frame[]
  selectedFrame: Frame | null
  setSelectedFrame: (frame: Frame | null) => void
  getIndexForFrame: (frame: Frame) => number | null
  getSearchMatchForFrame: (frame: Frame) => [number, number][] | null
}

export const SandwichViewContext = createContext<SandwichViewContextData | null>(null)

export const SandwichViewContainer = memo((ownProps: SandwichViewContainerProps) => {
  const {activeProfileState, glCanvas} = ownProps
  const {sandwichViewState, index} = activeProfileState
  const {callerCallee} = sandwichViewState

  const theme = useTheme()
  const setSelectedFrame = useCallback((selectedFrame: Frame | null) => {
    profileGroupAtom.setSelectedFrame(selectedFrame)
  }, [])

  const profile = activeProfileState.profile
  const tableSortMethod = useAtom(tableSortMethodAtom)
  const profileSearchResults = useContext(ProfileSearchContext)

  const selectedFrame = callerCallee ? callerCallee.selectedFrame : null

  const rowList: Frame[] = useMemo(() => {
    const rows: Frame[] = []

    profile.forEachFrame(frame => {
      if (profileSearchResults && !profileSearchResults.getMatchForFrame(frame)) {
        return
      }
      rows.push(frame)
    })

    switch (tableSortMethod.field) {
      case SortField.SYMBOL_NAME: {
        sortBy(rows, f => f.name.toLowerCase())
        break
      }
      case SortField.SELF: {
        sortBy(rows, f => f.getSelfWeight())
        break
      }
      case SortField.TOTAL: {
        sortBy(rows, f => f.getTotalWeight())
        break
      }
    }
    if (tableSortMethod.direction === SortDirection.DESCENDING) {
      rows.reverse()
    }

    return rows
  }, [profile, profileSearchResults, tableSortMethod])

  const getIndexForFrame: (frame: Frame) => number | null = useMemo(() => {
    const indexByFrame = new Map<Frame, number>()
    for (let i = 0; i < rowList.length; i++) {
      indexByFrame.set(rowList[i], i)
    }
    return (frame: Frame) => {
      const index = indexByFrame.get(frame)
      return index == null ? null : index
    }
  }, [rowList])

  const getSearchMatchForFrame: (frame: Frame) => [number, number][] | null = useMemo(() => {
    return (frame: Frame) => {
      if (profileSearchResults == null) return null
      return profileSearchResults.getMatchForFrame(frame)
    }
  }, [profileSearchResults])

  const contextData: SandwichViewContextData = {
    rowList,
    selectedFrame,
    setSelectedFrame,
    getIndexForFrame,
    getSearchMatchForFrame,
  }

  return (
    <SandwichViewContext.Provider value={contextData}>
      <SandwichView
        theme={theme}
        activeProfileState={activeProfileState}
        glCanvas={glCanvas}
        setSelectedFrame={setSelectedFrame}
        selectedFrame={selectedFrame}
        profileIndex={index}
      />
    </SandwichViewContext.Provider>
  )
})

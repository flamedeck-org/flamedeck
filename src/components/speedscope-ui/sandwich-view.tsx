import {Frame} from '../../lib/speedscope-core/profile'
import {ProfileTableViewContainer} from './profile-table-view'
import React, { JSX, createContext, memo, useCallback, useMemo, useContext, Component } from 'react'
import {Sizes, FontSize} from './style'
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
  onFrameSelectForComment?: (key: string | number | null) => void
  commentedFrameKeys?: (string | number)[]
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

    return (
      <div className="flex flex-row h-full">
        <div className="relative flex-1">
          <ProfileTableViewContainer activeProfileState={this.props.activeProfileState} />
          <SandwichSearchView />
        </div>
        {selectedFrame && (
          <div className="w-80 h-full flex-1 border-l border-l-border flex flex-col relative overflow-hidden">
            <div className="flex-1 flex flex-row">
              <div className="flex flex-col justify-end items-start text-xs w-[1.2em] border-r border-r-border shrink-0">
                <div className="w-[1.2em] shrink-1 transform -rotate-90 origin-center font-mono mb-1">Callers</div>
              </div>
              <InvertedCallerFlamegraphView
                glCanvas={this.props.glCanvas}
                activeProfileState={this.props.activeProfileState}
                onFrameSelectForComment={this.props.onFrameSelectForComment}
              />
            </div>
            <div className="h-0.5 bg-border" />
            <div className="flex-1 flex flex-row">
              <div className="flex flex-col justify-start items-start text-xs w-[1.2em] border-r border-r-border shrink-0">
                <div className="w-[1.2em] shrink-1 transform -rotate-90 origin-center flex justify-end font-mono mt-1">Callees</div>
              </div>
              <CalleeFlamegraphView
                glCanvas={this.props.glCanvas}
                activeProfileState={this.props.activeProfileState}
                onFrameSelectForComment={this.props.onFrameSelectForComment}
              />
            </div>
          </div>
        )}
      </div>
    )
  }
}

interface SandwichViewContainerProps {
  activeProfileState: ActiveProfileState
  glCanvas: HTMLCanvasElement
  onFrameSelectForComment?: (key: string | number | null) => void
  commentedFrameKeys?: (string | number)[]
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
  const {activeProfileState, glCanvas, onFrameSelectForComment, commentedFrameKeys} = ownProps
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
        onFrameSelectForComment={onFrameSelectForComment}
        commentedFrameKeys={commentedFrameKeys}
      />
    </SandwichViewContext.Provider>
  )
})

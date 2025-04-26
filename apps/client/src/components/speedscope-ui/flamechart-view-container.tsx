import React, { memo, useCallback, MouseEvent } from 'react'
import {CanvasContext} from '../../lib/speedscope-gl/canvas-context'
import {Flamechart} from '../../lib/speedscope-core/flamechart'
import {FlamechartRenderer, FlamechartRendererOptions} from '../../lib/speedscope-gl/flamechart-renderer'
import {Frame, Profile, CallTreeNode} from '../../lib/speedscope-core/profile'
import {memoizeByShallowEquality} from '../../lib/speedscope-core/lib-utils'
import {FlamechartView} from './flamechart-view'
import {
  getRowAtlas,
  createGetColorBucketForFrame,
  getCanvasContext,
  createGetCSSColorForFrame,
  getFrameToColorBucket,
} from '../../lib/speedscope-core/app-state/getters'
import {Vec2, Rect} from '../../lib/speedscope-core/math'
import {ActiveProfileState} from '../../lib/speedscope-core/app-state/active-profile-state'
import {FlamechartSearchContextProvider} from './flamechart-search-view'
import {Theme, useTheme} from './themes/theme'
import {FlamechartID, FlamechartViewState} from '../../lib/speedscope-core/app-state/profile-group'
import {profileGroupAtom} from '../../lib/speedscope-core/app-state'

interface FlamechartSetters {
  setLogicalSpaceViewportSize: (logicalSpaceViewportSize: Vec2) => void
  setConfigSpaceViewportRect: (configSpaceViewportRect: Rect) => void
  setNodeHover: (hover: {node: CallTreeNode; event: MouseEvent} | null) => void
  setSelectedNode: (node: CallTreeNode | null, cellId?: string | null) => void
}

export function useFlamechartSetters(id: FlamechartID, onNodeSelect: (node: CallTreeNode | null, cellId?: string | null) => void): FlamechartSetters {
  return {
    setNodeHover: useCallback(
      (hover: {node: CallTreeNode; event: MouseEvent} | null) => {
        profileGroupAtom.setFlamechartHoveredNode(id, hover)
      },
      [id],
    ),
    setLogicalSpaceViewportSize: useCallback(
      (logicalSpaceViewportSize: Vec2) => {
        profileGroupAtom.setLogicalSpaceViewportSize(id, logicalSpaceViewportSize)
      },
      [id],
    ),
    setConfigSpaceViewportRect: useCallback(
      (configSpaceViewportRect: Rect) => {
        profileGroupAtom.setConfigSpaceViewportRect(id, configSpaceViewportRect)
      },
      [id],
    ),
    setSelectedNode: useCallback(
      (selectedNode: CallTreeNode | null, cellId?: string | null) => {
        profileGroupAtom.setSelectedNode(id, selectedNode, cellId)
        onNodeSelect(selectedNode, cellId)
      },
      [id, onNodeSelect],
    ),
  }
}

export type FlamechartViewProps = {
  theme: Theme
  canvasContext: CanvasContext
  flamechart: Flamechart
  flamechartRenderer: FlamechartRenderer
  renderInverted: boolean
  getCSSColorForFrame: (frame: Frame) => string
} & FlamechartSetters &
  FlamechartViewState

export const getChronoViewFlamechart = memoizeByShallowEquality(
  ({
    profile,
    getColorBucketForFrame,
  }: {
    profile: Profile
    getColorBucketForFrame: (frame: Frame) => number
  }): Flamechart => {
    return new Flamechart({
      getTotalWeight: profile.getTotalWeight.bind(profile),
      forEachCall: profile.forEachCall.bind(profile),
      formatValue: profile.formatValue.bind(profile),
      getColorBucketForFrame,
    })
  },
)

export const createMemoizedFlamechartRenderer = (options?: FlamechartRendererOptions) =>
  memoizeByShallowEquality(
    ({
      canvasContext,
      flamechart,
    }: {
      canvasContext: CanvasContext
      flamechart: Flamechart
    }): FlamechartRenderer => {
      return new FlamechartRenderer(
        canvasContext.gl,
        getRowAtlas(canvasContext),
        flamechart,
        canvasContext.rectangleBatchRenderer,
        canvasContext.flamechartColorPassRenderer,
        options,
      )
    },
  )

const getChronoViewFlamechartRenderer = createMemoizedFlamechartRenderer()

export interface FlamechartViewContainerProps {
  activeProfileState: ActiveProfileState
  glCanvas: HTMLCanvasElement | null
  commentedCellIds?: string[]
  onNodeSelect: (node: CallTreeNode | null, cellId?: string | null) => void
}

export const ChronoFlamechartView = memo((props: FlamechartViewContainerProps) => {
  const {activeProfileState, glCanvas, commentedCellIds} = props
  const {profile, chronoViewState} = activeProfileState

  const theme = useTheme()

  const canvasContext = getCanvasContext({theme, canvas: glCanvas})
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})

  const flamechart = getChronoViewFlamechart({profile, getColorBucketForFrame})
  const flamechartRenderer = getChronoViewFlamechartRenderer({
    canvasContext,
    flamechart,
  })

  const setters = useFlamechartSetters(FlamechartID.CHRONO, props.onNodeSelect)

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={chronoViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={chronoViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        theme={theme}
        renderInverted={false}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        {...chronoViewState}
        setNodeHover={setters.setNodeHover}
        setLogicalSpaceViewportSize={setters.setLogicalSpaceViewportSize}
        setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
        setSelectedNode={setters.setSelectedNode}
        commentedCellIds={commentedCellIds}
      />
    </FlamechartSearchContextProvider>
  )
})

export const getLeftHeavyFlamechart = memoizeByShallowEquality(
  ({
    profile,
    getColorBucketForFrame,
  }: {
    profile: Profile
    getColorBucketForFrame: (frame: Frame) => number
  }): Flamechart => {
    return new Flamechart({
      getTotalWeight: profile.getTotalNonIdleWeight.bind(profile),
      forEachCall: profile.forEachCallGrouped.bind(profile),
      formatValue: profile.formatValue.bind(profile),
      getColorBucketForFrame,
    })
  },
)

const getLeftHeavyFlamechartRenderer = createMemoizedFlamechartRenderer()

export const LeftHeavyFlamechartView = memo((ownProps: FlamechartViewContainerProps) => {
  const {activeProfileState, glCanvas, commentedCellIds, onNodeSelect} = ownProps

  const {profile, leftHeavyViewState} = activeProfileState

  const theme = useTheme()

  const canvasContext = getCanvasContext({theme, canvas: glCanvas})
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})

  const flamechart = getLeftHeavyFlamechart({
    profile,
    getColorBucketForFrame,
  })
  const flamechartRenderer = getLeftHeavyFlamechartRenderer({
    canvasContext,
    flamechart,
  })

  const setters = useFlamechartSetters(FlamechartID.LEFT_HEAVY, onNodeSelect)

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={leftHeavyViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={leftHeavyViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        theme={theme}
        renderInverted={false}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        {...leftHeavyViewState}
        setNodeHover={setters.setNodeHover}
        setLogicalSpaceViewportSize={setters.setLogicalSpaceViewportSize}
        setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
        setSelectedNode={setters.setSelectedNode}
        commentedCellIds={commentedCellIds}
      />
    </FlamechartSearchContextProvider>
  )
})

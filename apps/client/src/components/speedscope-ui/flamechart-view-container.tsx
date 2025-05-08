import type { MouseEvent} from 'react';
import React, { memo, useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import type {CanvasContext} from '../../lib/speedscope-gl/canvas-context'
import {Flamechart} from '../../lib/speedscope-core/flamechart'
import type { FlamechartRendererOptions} from '../../lib/speedscope-gl/flamechart-renderer';
import {FlamechartRenderer} from '../../lib/speedscope-gl/flamechart-renderer'
import type {Frame, Profile, CallTreeNode} from '../../lib/speedscope-core/profile'
import {memoizeByShallowEquality} from '../../lib/speedscope-core/lib-utils'
import {FlamechartView} from './flamechart-view'
import {
  getRowAtlas,
  createGetColorBucketForFrame,
  getCanvasContext,
  createGetCSSColorForFrame,
  getFrameToColorBucket,
} from '../../lib/speedscope-core/app-state/getters'
import type {Vec2, Rect} from '../../lib/speedscope-core/math'
import type {ActiveProfileState} from '../../lib/speedscope-core/app-state/active-profile-state'
import {FlamechartSearchContextProvider} from './flamechart-search-view'
import type {Theme} from './themes/theme';
import { useTheme} from './themes/theme'
import type { FlamechartViewState} from '../../lib/speedscope-core/app-state/profile-group';
import {FlamechartID} from '../../lib/speedscope-core/app-state/profile-group'
import {profileGroupAtom} from '../../lib/speedscope-core/app-state'

// Define the handle type that will be exposed via the ref
export interface FlamechartViewHandle {
  drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => void;
}

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

// Use forwardRef to allow parent components to get a ref to FlamechartView
export const ChronoFlamechartView = memo(forwardRef<FlamechartViewHandle, FlamechartViewContainerProps>((props, ref) => {
  const {activeProfileState, glCanvas, commentedCellIds} = props
  const {profile, chronoViewState} = activeProfileState

  // Create a ref for the underlying FlamechartView instance
  const flamechartViewRef = useRef<FlamechartView | null>(null);

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

  // Expose the drawOverlayOnto method via the ref handle
  useImperativeHandle(ref, () => ({
    drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => {
      flamechartViewRef.current?.drawOverlayOnto(targetCtx);
    }
  }));

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={chronoViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={chronoViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        ref={flamechartViewRef} // Assign the ref here
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
}))

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

// Use forwardRef for LeftHeavyFlamechartView as well
export const LeftHeavyFlamechartView = memo(forwardRef<FlamechartViewHandle, FlamechartViewContainerProps>((props, ref) => {
  const {activeProfileState, glCanvas, commentedCellIds, onNodeSelect} = props

  const {profile, leftHeavyViewState} = activeProfileState

  // Create a ref for the underlying FlamechartView instance
  const flamechartViewRef = useRef<FlamechartView | null>(null);

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

  // Expose the drawOverlayOnto method via the ref handle
  useImperativeHandle(ref, () => ({
    drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => {
      flamechartViewRef.current?.drawOverlayOnto(targetCtx);
    }
  }));

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={leftHeavyViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={leftHeavyViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        ref={flamechartViewRef} // Assign the ref here
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
}))

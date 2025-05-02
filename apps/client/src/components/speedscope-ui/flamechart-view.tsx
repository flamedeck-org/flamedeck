import { Fragment, Component, MouseEvent as ReactMouseEvent, forwardRef, useRef, useImperativeHandle } from 'react';

import {CallTreeNode } from '../../lib/speedscope-core/profile';
import {Rect, Vec2, AffineTransform} from '../../lib/speedscope-core/math';
import {formatPercent} from '../../lib/speedscope-core/lib-utils';
import {FlamechartMinimapView} from './flamechart-minimap-view'

import {Sizes } from './style'
import {FlamechartDetailView} from './flamechart-detail-view'
import {FlamechartPanZoomView} from './flamechart-pan-zoom-view'
import {Hovertip} from './hovertip'
import {FlamechartViewProps as FlamechartViewContainerProps} from './flamechart-view-container'
import {ProfileSearchContext} from './search-view'
import {FlamechartSearchView} from './flamechart-search-view'

// Define the handle type that will be exposed via the ref
// This should match the methods we want to call on FlamechartPanZoomView
export interface FlamechartViewRef {
  drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => void;
  // Add other methods if needed
}

// Use FlamechartViewContainerProps directly instead of the empty interface
export const FlamechartView = forwardRef<FlamechartViewRef, FlamechartViewContainerProps>((props, ref) => {
  // Create a ref for the FlamechartPanZoomView instance
  const panZoomViewRef = useRef<FlamechartPanZoomView>(null);

  // Use useImperativeHandle to expose methods from FlamechartPanZoomView
  useImperativeHandle(ref, () => ({
    drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => {
      panZoomViewRef.current?.drawOverlayOnto(targetCtx);
    }
    // Expose other methods from panZoomViewRef.current if needed
  }));

  // Replicate the class component's logic within a functional component structure
  // Most methods can be moved inside or defined as callbacks
  const configSpaceSize = () => {
    return new Vec2(
      props.flamechart.getTotalWeight(),
      props.flamechart.getLayers().length,
    )
  }

  const setConfigSpaceViewportRect = (viewportRect: Rect): void => {
    const configSpaceDetailViewHeight = Sizes.DETAIL_VIEW_HEIGHT / Sizes.FRAME_HEIGHT

    const currentConfigSpaceSize = configSpaceSize(); // Use the function

    const width = props.flamechart.getClampedViewportWidth(viewportRect.size.x)
    const size = viewportRect.size.withX(width)

    const origin = Vec2.clamp(
      viewportRect.origin,
      new Vec2(0, -1),
      Vec2.max(
        Vec2.zero,
        currentConfigSpaceSize.minus(size).plus(new Vec2(0, configSpaceDetailViewHeight + 1)),
      ),
    )

    props.setConfigSpaceViewportRect(new Rect(origin, viewportRect.size.withX(width)))
  }

  const setLogicalSpaceViewportSize = (logicalSpaceViewportSize: Vec2): void => {
    props.setLogicalSpaceViewportSize(logicalSpaceViewportSize)
  }

  const transformViewport = (transform: AffineTransform): void => {
    setConfigSpaceViewportRect(transform.transformRect(props.configSpaceViewportRect))
  }

  const onNodeHover = (hover: {node: CallTreeNode; event: ReactMouseEvent} | null) => {
    props.setNodeHover(hover)
  }

  const onNodeClick = (node: CallTreeNode | null, cellId?: string | null) => {
    props.setSelectedNode(node, cellId)
  }

  const formatValue = (weight: number) => {
    const totalWeight = props.flamechart.getTotalWeight()
    const percent = (100 * weight) / totalWeight
    const formattedPercent = formatPercent(percent)
    return `${props.flamechart.formatValue(weight)} (${formattedPercent})`
  }

  const renderTooltip = () => {
    // Note: Need a way to get the container ref if Hovertip depends on it
    // For now, assume Hovertip can work without explicit container ref from here
    const {hover} = props
    if (!hover) return null
    // This calculation might need adjustment if containerRef is strictly required by Hovertip
    const rect = (hover.event.target as Element)?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 };
    const offset = new Vec2(hover.event.clientX - rect.left, hover.event.clientY - rect.top)
    const frame = hover.node.frame

    return (
      <Hovertip containerSize={new Vec2(rect.width, rect.height)} offset={offset}>
        <span className="text-green-500">
          {formatValue(hover.node.getTotalWeight())}
        </span>{' '}
        {frame.name}
        {frame.file ? (
          <div>
            {frame.file}:{frame.line}
          </div>
        ) : undefined}
      </Hovertip>
    )
  }

  // const containerRef = useRef<HTMLDivElement>(null); // Keep if needed by Hovertip

  // Return the JSX structure from the original render method
  return (
    <div className="w-full h-full flex flex-col left-0 top-0 relative overflow-hidden" /* ref={containerRef} */ >
      <FlamechartMinimapView
        theme={props.theme}
        configSpaceViewportRect={props.configSpaceViewportRect}
        transformViewport={transformViewport}
        flamechart={props.flamechart}
        flamechartRenderer={props.flamechartRenderer}
        canvasContext={props.canvasContext}
        setConfigSpaceViewportRect={setConfigSpaceViewportRect}
      />
      <ProfileSearchContext.Consumer>
        {searchResults => (
          <Fragment>
            <FlamechartPanZoomView
              ref={panZoomViewRef} // Pass the ref down
              theme={props.theme}
              canvasContext={props.canvasContext}
              flamechart={props.flamechart}
              flamechartRenderer={props.flamechartRenderer}
              renderInverted={false}
              onNodeHover={onNodeHover}
              onNodeSelect={onNodeClick}
              selectedNode={props.selectedNode}
              transformViewport={transformViewport}
              configSpaceViewportRect={props.configSpaceViewportRect}
              setConfigSpaceViewportRect={setConfigSpaceViewportRect}
              logicalSpaceViewportSize={props.logicalSpaceViewportSize}
              setLogicalSpaceViewportSize={setLogicalSpaceViewportSize}
              searchResults={searchResults}
              commentedCellIds={props.commentedCellIds}
            />
            <FlamechartSearchView />
          </Fragment>
        )}
      </ProfileSearchContext.Consumer>
      {renderTooltip()}
      {props.selectedNode && (
        <FlamechartDetailView
          flamechart={props.flamechart}
          getCSSColorForFrame={props.getCSSColorForFrame}
          selectedNode={props.selectedNode}
        />
      )}
    </div>
  );
});

// Original class component remains commented out or removed
/*
export class FlamechartView extends Component<FlamechartViewProps> {
  // ... original class component implementation ...
}
*/

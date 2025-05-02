import React, { useRef, forwardRef, useImperativeHandle } from 'react'
import {CallTreeNode} from '../../lib/speedscope-core/profile'
import {Rect, AffineTransform, Vec2} from '../../lib/speedscope-core/math'
import {FlamechartPanZoomView} from './flamechart-pan-zoom-view'
import {noop, formatPercent} from '../../lib/speedscope-core/lib-utils'
import {Hovertip} from './hovertip'
import {FlamechartViewProps, FlamechartHover, FlamechartViewHandle} from './flamechart-view-container'

// Change from class component to functional component with forwardRef
export const FlamechartWrapper = forwardRef<FlamechartViewHandle, FlamechartViewProps>((props, ref) => {
  // Create refs
  const containerRef = useRef<HTMLDivElement>(null);
  const flamechartPanZoomViewRef = useRef<FlamechartPanZoomView>(null);
  
  // Expose drawOverlayOnto method via ref
  useImperativeHandle(ref, () => ({
    drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => {
      flamechartPanZoomViewRef.current?.drawOverlayOnto(targetCtx);
    }
  }));

  // Convert class methods to functions inside the component
  const clampViewportToFlamegraph = (viewportRect: Rect): Rect => {
    const {flamechart, renderInverted} = props;
    return flamechart.getClampedConfigSpaceViewportRect({
      configSpaceViewportRect: viewportRect,
      renderInverted,
    });
  };

  const setConfigSpaceViewportRect = (configSpaceViewportRect: Rect): void => {
    props.setConfigSpaceViewportRect(clampViewportToFlamegraph(configSpaceViewportRect));
  };

  const setLogicalSpaceViewportSize = (logicalSpaceViewportSize: Vec2): void => {
    props.setLogicalSpaceViewportSize(logicalSpaceViewportSize);
  };

  const transformViewport = (transform: AffineTransform): void => {
    setConfigSpaceViewportRect(transform.transformRect(props.configSpaceViewportRect));
  };

  const formatValue = (weight: number): string => {
    const totalWeight = props.flamechart.getTotalWeight();
    const percent = (100 * weight) / totalWeight;
    const formattedPercent = formatPercent(percent);
    return `${props.flamechart.formatValue(weight)} (${formattedPercent})`;
  };

  const setNodeHover = (hover: FlamechartHover | null): void => {
    props.setNodeHover(hover);
  };

  // Render tooltip function
  const renderTooltip = () => {
    const container = containerRef.current;
    if (!container) return null;

    const {hover} = props;
    if (!hover) return null;

    const {width, height, left, top} = container.getBoundingClientRect();

    const event = hover.event as unknown as React.MouseEvent;
    const offset = new Vec2(event.clientX - left, event.clientY - top);
    const frame = hover.node.frame;

    return (
      <Hovertip containerSize={new Vec2(width, height)} offset={offset}>
        <span className="font-semibold">{formatValue(hover.node.getTotalWeight())}</span>{' '}
        {frame.name}
        {frame.file ? (
          <div>
            {frame.file}:{frame.line}
          </div>
        ) : undefined}
      </Hovertip>
    );
  };

  // Return the JSX
  return (
    <div
      className="h-full w-full flex flex-col relative"
      ref={containerRef}
    >
      <FlamechartPanZoomView
        ref={flamechartPanZoomViewRef}
        theme={props.theme}
        selectedNode={null}
        onNodeHover={setNodeHover}
        onNodeSelect={noop}
        configSpaceViewportRect={props.configSpaceViewportRect}
        setConfigSpaceViewportRect={setConfigSpaceViewportRect}
        transformViewport={transformViewport}
        flamechart={props.flamechart}
        flamechartRenderer={props.flamechartRenderer}
        canvasContext={props.canvasContext}
        renderInverted={props.renderInverted}
        logicalSpaceViewportSize={props.logicalSpaceViewportSize}
        setLogicalSpaceViewportSize={setLogicalSpaceViewportSize}
        searchResults={null}
      />
      {renderTooltip()}
    </div>
  );
});
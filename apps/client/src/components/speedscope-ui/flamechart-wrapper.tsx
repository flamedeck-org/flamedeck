import React, { useRef, forwardRef, useImperativeHandle } from 'react'
import type {CallTreeNode} from '../../lib/speedscope-core/profile'
import type {Rect, AffineTransform, Vec2} from '../../lib/speedscope-core/math'
import {FlamechartPanZoomView, type HoverPayload} from './flamechart-pan-zoom-view'
import {noop, formatPercent} from '../../lib/speedscope-core/lib-utils'
import type {FlamechartViewProps, FlamechartViewHandle} from './flamechart-view-container';
import { FlamechartHover} from './flamechart-view-container'
import { ContextMenu, ContextMenuDivider } from '@/components/ui/context-menu';
import { useState, useEffect } from 'react';

// Change from class component to functional component with forwardRef
export const FlamechartWrapper = forwardRef<FlamechartViewHandle, FlamechartViewProps>((props, ref) => {
  // Create refs
  const containerRef = useRef<HTMLDivElement>(null);
  const flamechartPanZoomViewRef = useRef<FlamechartPanZoomView>(null);
  
  // State and Ref for hover context menu
  const [hoverMenu, setHoverMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: CallTreeNode | null;
    cellId: string | null; // Assuming cellId is part of HoverPayload
  }>({ visible: false, x: 0, y: 0, node: null, cellId: null });
  const hideMenuTimeoutRef = useRef<number | null>(null);

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

  // Updated setNodeHover to manage the hover context menu
  const setNodeHover = (hover: HoverPayload | null): void => {
    props.setNodeHover(hover); // Propagate hover if parent needs it

    // Clear any existing hide timeout
    if (hideMenuTimeoutRef.current) {
      clearTimeout(hideMenuTimeoutRef.current);
      hideMenuTimeoutRef.current = null;
    }

    if (hover) {
      const menuOffset = 5; // Same offset as in FlamechartView
      // Offset the menu slightly from the cursor position.
      setHoverMenu({
        visible: true,
        x: hover.event.clientX + menuOffset,
        y: hover.event.clientY + menuOffset,
        node: hover.node,
        cellId: hover.cellId // Assuming cellId is in HoverPayload
      });
    } else {
      // Set timeout to hide the menu
      hideMenuTimeoutRef.current = setTimeout(() => {
        setHoverMenu({ visible: false, x: 0, y: 0, node: null, cellId: null });
      }, 100); // 100ms delay
    }
  };

  // Cleanup effect for the timeout
  useEffect(() => {
    return () => {
      if (hideMenuTimeoutRef.current) {
        clearTimeout(hideMenuTimeoutRef.current);
      }
    };
  }, []);

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
      {/* Render the ContextMenu based on hover state */} 
      {hoverMenu.visible && hoverMenu.node && (
        <ContextMenu
          x={hoverMenu.x} // Position directly using offset coordinates
          y={hoverMenu.y}
          onClose={() => setHoverMenu({ ...hoverMenu, visible: false })}
          frameKey={hoverMenu.cellId}
        >
          <div className="px-3 py-1.5">
            <div className="truncate max-w-[300px] font-mono">
              {hoverMenu.node.frame.name}
            </div>
            {hoverMenu.node.frame.file && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {hoverMenu.node.frame.file}
                {hoverMenu.node.frame.line && `:${hoverMenu.node.frame.line}`}
              </div>
            )}
            <div className="text-xs flex justify-between mt-1">
              <span className="text-muted-foreground pr-3">Total: {formatValue(hoverMenu.node.getTotalWeight())}</span>
              <span className="text-muted-foreground">Self: {formatValue(hoverMenu.node.getSelfWeight())}</span>
            </div>
          </div>
          {/* Removed ContextMenuDivider to match FlamechartView change */}
        </ContextMenu>
      )}
    </div>
  );
});
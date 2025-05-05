import { Fragment, Component, MouseEvent as ReactMouseEvent, forwardRef, useRef, useImperativeHandle, useEffect, memo } from 'react';

import {CallTreeNode } from '../../lib/speedscope-core/profile';
import {Rect, Vec2, AffineTransform} from '../../lib/speedscope-core/math';
import {formatPercent} from '../../lib/speedscope-core/lib-utils.ts';
import {FlamechartMinimapView} from './flamechart-minimap-view'

import {Sizes } from './style'
import {FlamechartDetailView} from './flamechart-detail-view'
import {FlamechartPanZoomView, type HoverPayload} from './flamechart-pan-zoom-view'
import {FlamechartViewProps as FlamechartViewContainerProps} from './flamechart-view-container'
import {ProfileSearchContext} from './search-view'
import {FlamechartSearchView} from './flamechart-search-view'
import { ContextMenu, ContextMenuDivider } from '@/components/ui/context-menu';
import { useState } from 'react';

// Define the handle type that will be exposed via the ref
// This should match the methods we want to call on FlamechartPanZoomView
export interface FlamechartViewRef {
  drawOverlayOnto: (targetCtx: CanvasRenderingContext2D) => void;
  // Add other methods if needed
}

// Use FlamechartViewContainerProps directly instead of the empty interface
// Wrap with React.memo for performance optimization (similar to shouldComponentUpdate)
export const FlamechartView = memo(forwardRef<FlamechartViewRef, FlamechartViewContainerProps>((props, ref) => {
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
      props.flamechart?.getTotalWeight() ?? 0,
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

  // State for managing the context menu triggered by hover
  const [hoverMenu, setHoverMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: CallTreeNode | null;
    cellId: string | null;
  }>({ visible: false, x: 0, y: 0, node: null, cellId: null });

  // Ref to store the timeout ID for debouncing the hover menu hide
  const hideMenuTimeoutRef = useRef<number | null>(null);

  const setLogicalSpaceViewportSize = (logicalSpaceViewportSize: Vec2): void => {
    props.setLogicalSpaceViewportSize(logicalSpaceViewportSize)
  }

  const transformViewport = (transform: AffineTransform): void => {
    setConfigSpaceViewportRect(transform.transformRect(props.configSpaceViewportRect))
  }

  // Updated onNodeHover to handle the new payload and manage hover context menu state
  const onNodeHover = (hover: HoverPayload | null) => {
    props.setNodeHover(hover); 

    // Clear any existing timeout to prevent hiding if hover moves to another frame quickly
    if (hideMenuTimeoutRef.current) {
      clearTimeout(hideMenuTimeoutRef.current);
      hideMenuTimeoutRef.current = null;
    }

    if (hover) {
      const menuOffset = 5; // Pixels to offset the menu from the cursor
      // Offset the menu slightly from the cursor position.
      // This prevents the menu itself from appearing directly under the cursor
      // and interfering with the hover detection on the underlying canvas,
      // which could cause flickering as the hover state rapidly toggles on/off.
      setHoverMenu({
        visible: true,
        x: hover.event.clientX + menuOffset,
        y: hover.event.clientY + menuOffset,
        node: hover.node,
        cellId: hover.cellId
      });
    } else {
      // Set a timeout to hide the menu after a short delay
      hideMenuTimeoutRef.current = setTimeout(() => {
        setHoverMenu({ visible: false, x: 0, y: 0, node: null, cellId: null });
      }, 100); // 100ms delay
    }
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

  // Effect to clear the timeout when the component unmounts
  useEffect(() => {
    return () => {
      if (hideMenuTimeoutRef.current) {
        clearTimeout(hideMenuTimeoutRef.current);
      }
    };
  }, []);

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
      {/* Render the ContextMenu based on hover state */} 
      {hoverMenu.visible && hoverMenu.node && (
        <ContextMenu
          x={hoverMenu.x} // Position directly using mouse coordinates
          y={hoverMenu.y} // Position directly using mouse coordinates
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
        </ContextMenu>
      )}
      {props.selectedNode && (
        <FlamechartDetailView
          flamechart={props.flamechart}
          getCSSColorForFrame={props.getCSSColorForFrame}
          selectedNode={props.selectedNode}
        />
      )}
    </div>
  );
})); // Close memo and forwardRef

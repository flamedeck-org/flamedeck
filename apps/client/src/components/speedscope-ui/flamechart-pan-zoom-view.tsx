import { Rect, AffineTransform, Vec2, clamp } from '@flamedeck/speedscope-core/math';
import type { CallTreeNode } from '@flamedeck/speedscope-core/profile';
import type { Flamechart, FlamechartFrame } from '@flamedeck/speedscope-core/flamechart';
import type { CanvasContext } from '@flamedeck/speedscope-gl/src/canvas-context';
import type { FlamechartRenderer } from '@flamedeck/speedscope-gl/src/flamechart-renderer';
import { Sizes, FontSize, FontFamily } from './style.ts';
import {
  cachedMeasureTextWidth,
  ELLIPSIS,
  trimTextMid,
  remapRangesToTrimmedText,
} from '@flamedeck/speedscope-core/text-utils';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Component } from 'react';
import type { ProfileSearchResults } from '@/lib/speedscope-core/profile-search';
import {
  BatchCanvasTextRenderer,
  BatchCanvasRectRenderer,
} from '@/lib/speedscope-core/canvas-2d-batch-renderers.ts';
import { Color } from '@flamedeck/speedscope-core/color';
import type { Theme } from '@flamedeck/speedscope-theme/types';

interface FlamechartFrameLabel {
  configSpaceBounds: Rect;
  node: CallTreeNode;
  frameStart: number;
  depth: number;
}

// Define the shape of the hover payload
interface HoverPayload {
  node: CallTreeNode;
  event: ReactMouseEvent<HTMLDivElement>;
  cellId: string;
  frameStart: number;
  depth: number;
}

/**
 * Component to visualize a Flamechart and interact with it via hovering,
 * zooming, and panning.
 *
 * There are 3 vector spaces involved:
 * - Configuration Space: In this space, the horizontal unit is ms, and the
 *   vertical unit is stack depth. Each stack frame is one unit high.
 * - Logical view space: Origin is top-left, with +y downwards. This represents
 *   the coordinate space of the view as specified in CSS: horizontal and vertical
 *   units are both "logical" pixels.
 * - Physical view space: Origin is top-left, with +y downwards. This represents
 *   the coordinate space of the view as specified in hardware pixels: horizontal
 *   and vertical units are both "physical" pixels.
 *
 * We use two canvases to draw the flamechart itself: one for the rectangles,
 * which we render via WebGL, and one for the labels, which we render via 2D
 * canvas primitives.
 */
export interface FlamechartPanZoomViewProps {
  flamechart: Flamechart;
  canvasContext: CanvasContext;
  flamechartRenderer: FlamechartRenderer;
  renderInverted: boolean;
  selectedNode: CallTreeNode | null;
  theme: Theme;

  onNodeHover: (hover: HoverPayload | null) => void;
  onNodeSelect: (node: CallTreeNode | null, cellId?: string | null) => void;

  configSpaceViewportRect: Rect;
  transformViewport: (transform: AffineTransform) => void;
  setConfigSpaceViewportRect: (rect: Rect) => void;

  logicalSpaceViewportSize: Vec2;
  setLogicalSpaceViewportSize: (size: Vec2) => void;

  searchResults: ProfileSearchResults | null;
  commentedCellIds?: string[];
}

// Define a type for the overlay rendering parameters to avoid repetition
type OverlayRenderParams = {
  ctx: CanvasRenderingContext2D;
  physicalViewSize: Vec2;
  configToPhysical: AffineTransform;
  physicalViewSpaceFontSize: number;
  physicalViewSpaceFrameHeight: number;
  minWidthToRender: number;
  minConfigSpaceWidthToRender: number;
  minConfigSpaceWidthToRenderOutline: number;
  LABEL_PADDING_PX: number;
  frameOutlineWidth: number;
};

export class FlamechartPanZoomView extends Component<
  FlamechartPanZoomViewProps,
  Record<string, never> // Use Record<string, never> for empty state
> {
  constructor(props: FlamechartPanZoomViewProps) {
    super(props);
  }

  private container: Element | null = null;
  private containerRef = (element: Element | null) => {
    this.container = element || null;
  };

  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  private hoveredLabel: FlamechartFrameLabel | null = null;

  private setConfigSpaceViewportRect(r: Rect) {
    this.props.setConfigSpaceViewportRect(r);
  }

  private overlayCanvasRef = (element: Element | null) => {
    if (element) {
      this.overlayCanvas = element as HTMLCanvasElement;
      this.overlayCtx = this.overlayCanvas.getContext('2d');
      this.renderCanvas();
    } else {
      this.overlayCanvas = null;
      this.overlayCtx = null;
    }
  };

  private configSpaceSize() {
    return new Vec2(
      this.props.flamechart.getTotalWeight(),
      this.props.flamechart.getLayers().length
    );
  }

  private physicalViewSize() {
    return new Vec2(
      this.overlayCanvas ? this.overlayCanvas.width : 0,
      this.overlayCanvas ? this.overlayCanvas.height : 0
    );
  }

  private physicalBounds(): Rect {
    if (this.props.renderInverted) {
      // If we're rendering inverted and the flamegraph won't fill the viewport,
      // we want to stick the flamegraph to the bottom of the viewport, not the top.

      const physicalViewportHeight = this.physicalViewSize().y;
      const physicalFlamegraphHeight =
        (this.configSpaceSize().y + 1) *
        this.LOGICAL_VIEW_SPACE_FRAME_HEIGHT *
        window.devicePixelRatio;

      if (physicalFlamegraphHeight < physicalViewportHeight) {
        return new Rect(
          new Vec2(0, physicalViewportHeight - physicalFlamegraphHeight),
          this.physicalViewSize()
        );
      }
    }

    return new Rect(new Vec2(0, 0), this.physicalViewSize());
  }

  private LOGICAL_VIEW_SPACE_FRAME_HEIGHT = Sizes.FRAME_HEIGHT;

  private configSpaceToPhysicalViewSpace() {
    return AffineTransform.betweenRects(this.props.configSpaceViewportRect, this.physicalBounds());
  }

  private logicalToPhysicalViewSpace() {
    return AffineTransform.withScale(new Vec2(window.devicePixelRatio, window.devicePixelRatio));
  }

  private resizeOverlayCanvasIfNeeded() {
    if (!this.overlayCanvas) return;
    let { width, height } = this.overlayCanvas.getBoundingClientRect();
    {
      /*
      We render text at a higher resolution then scale down to
      ensure we're rendering at 1:1 device pixel ratio.
      This ensures our text is rendered crisply.
    */
    }
    width = Math.floor(width);
    height = Math.floor(height);

    // Still initializing: don't resize yet
    if (width === 0 || height === 0) return;

    const scaledWidth = width * window.devicePixelRatio;
    const scaledHeight = height * window.devicePixelRatio;

    if (scaledWidth === this.overlayCanvas.width && scaledHeight === this.overlayCanvas.height)
      return;

    this.overlayCanvas.width = scaledWidth;
    this.overlayCanvas.height = scaledHeight;
  }

  // --- Method to draw overlay content onto a given context ---
  public drawOverlayOnto(targetCtx: CanvasRenderingContext2D) {
    // Ensure the component has the necessary info (size, viewport)
    if (this.props.configSpaceViewportRect.isEmpty() || !this.overlayCanvas) return;

    // Save the current state of the target context (including any applied scaling)
    targetCtx.save();

    // Use the component's current physical size and transformations
    const physicalViewSize = this.physicalViewSize();
    const configToPhysical = this.configSpaceToPhysicalViewSpace();
    const physicalViewSpaceFontSize = FontSize.LABEL * window.devicePixelRatio;
    const physicalViewSpaceFrameHeight =
      this.LOGICAL_VIEW_SPACE_FRAME_HEIGHT * window.devicePixelRatio;
    const frameOutlineWidth = 2 * window.devicePixelRatio;

    // Pre-calculate minimum widths needed for rendering based on the target context
    targetCtx.font = `${physicalViewSpaceFontSize}px/${physicalViewSpaceFrameHeight}px ${FontFamily.MONOSPACE}`;
    targetCtx.textBaseline = 'alphabetic'; // Ensure consistent baseline
    const minWidthToRender = cachedMeasureTextWidth(targetCtx, 'M' + ELLIPSIS + 'M');
    const minConfigSpaceWidthToRender = (
      configToPhysical.inverseTransformVector(new Vec2(minWidthToRender, 0)) || new Vec2(0, 0)
    ).x;
    const minConfigSpaceWidthToRenderOutline = (
      configToPhysical.inverseTransformVector(new Vec2(1, 0)) || new Vec2(0, 0)
    ).x;
    const LABEL_PADDING_PX = 5 * window.devicePixelRatio;

    const params: OverlayRenderParams = {
      ctx: targetCtx,
      physicalViewSize,
      configToPhysical,
      physicalViewSpaceFontSize,
      physicalViewSpaceFrameHeight,
      minWidthToRender,
      minConfigSpaceWidthToRender,
      minConfigSpaceWidthToRenderOutline,
      LABEL_PADDING_PX,
      frameOutlineWidth,
    };

    // Skip clearing the target context when drawing onto a snapshot canvas
    // targetCtx.clearRect(0, 0, physicalViewSize.x, physicalViewSize.y);

    // Call the refactored drawing logic
    this._renderOverlayContent(params);
    this._renderTimeIndicators(params);

    // Restore the target context to its original state
    targetCtx.restore();
  }
  // -----------------------------------------------------------

  // Refactored overlay rendering logic
  private _renderOverlayContent(params: OverlayRenderParams) {
    const {
      ctx,
      physicalViewSize,
      configToPhysical,
      physicalViewSpaceFontSize,
      physicalViewSpaceFrameHeight,
      minWidthToRender,
      minConfigSpaceWidthToRender,
      minConfigSpaceWidthToRenderOutline,
      LABEL_PADDING_PX,
      frameOutlineWidth,
    } = params;

    // Set font properties on the target context
    ctx.font = `${physicalViewSpaceFontSize}px/${physicalViewSpaceFrameHeight}px ${FontFamily.MONOSPACE}`;
    ctx.textBaseline = 'alphabetic';

    const labelBatch = new BatchCanvasTextRenderer();
    const fadedLabelBatch = new BatchCanvasTextRenderer();
    const matchedTextHighlightBatch = new BatchCanvasRectRenderer();
    const directlySelectedOutlineBatch = new BatchCanvasRectRenderer();
    const indirectlySelectedOutlineBatch = new BatchCanvasRectRenderer();
    const matchedFrameBatch = new BatchCanvasRectRenderer();
    const commentedFrameBatch = new BatchCanvasRectRenderer();

    const renderFrameLabelAndChildren = (frame: FlamechartFrame, depth = 0) => {
      const width = frame.end - frame.start;
      const y = this.props.renderInverted ? this.configSpaceSize().y - 1 - depth : depth;
      const configSpaceBounds = new Rect(new Vec2(frame.start, y), new Vec2(width, 1));

      if (width < minConfigSpaceWidthToRender) return;
      if (configSpaceBounds.left() > this.props.configSpaceViewportRect.right()) return;
      if (configSpaceBounds.right() < this.props.configSpaceViewportRect.left()) return;

      if (this.props.renderInverted) {
        if (configSpaceBounds.bottom() < this.props.configSpaceViewportRect.top()) return;
      } else {
        if (configSpaceBounds.top() > this.props.configSpaceViewportRect.bottom()) return;
      }

      if (configSpaceBounds.hasIntersectionWith(this.props.configSpaceViewportRect)) {
        let physicalLabelBounds = configToPhysical.transformRect(configSpaceBounds);

        if (physicalLabelBounds.left() < 0) {
          physicalLabelBounds = physicalLabelBounds
            .withOrigin(physicalLabelBounds.origin.withX(0))
            .withSize(
              physicalLabelBounds.size.withX(
                physicalLabelBounds.size.x + physicalLabelBounds.left()
              )
            );
        }
        if (physicalLabelBounds.right() > physicalViewSize.x) {
          physicalLabelBounds = physicalLabelBounds.withSize(
            physicalLabelBounds.size.withX(physicalViewSize.x - physicalLabelBounds.left())
          );
        }

        if (physicalLabelBounds.width() > minWidthToRender) {
          const match = this.props.searchResults?.getMatchForFrame(frame.node.frame);

          const trimmedText = trimTextMid(
            ctx,
            frame.node.frame.name,
            physicalLabelBounds.width() - 2 * LABEL_PADDING_PX
          );

          if (match) {
            const rangesToHighlightInTrimmedText = remapRangesToTrimmedText(trimmedText, match);

            let lastEndIndex = 0;
            let left = physicalLabelBounds.left() + LABEL_PADDING_PX;

            const padding = (physicalViewSpaceFrameHeight - physicalViewSpaceFontSize) / 2 - 2;
            for (const [startIndex, endIndex] of rangesToHighlightInTrimmedText) {
              left += cachedMeasureTextWidth(
                ctx,
                trimmedText.trimmedString.substring(lastEndIndex, startIndex)
              );
              const highlightWidth = cachedMeasureTextWidth(
                ctx,
                trimmedText.trimmedString.substring(startIndex, endIndex)
              );
              matchedTextHighlightBatch.rect({
                x: left,
                y: physicalLabelBounds.top() + padding,
                w: highlightWidth,
                h: physicalViewSpaceFrameHeight - 2 * padding,
              });

              left += highlightWidth;
              lastEndIndex = endIndex;
            }
          }

          const batch = this.props.searchResults != null && !match ? fadedLabelBatch : labelBatch;
          batch.text({
            text: trimmedText.trimmedString,
            x: physicalLabelBounds.left() + LABEL_PADDING_PX,
            y: Math.round(
              physicalLabelBounds.bottom() -
                (physicalViewSpaceFrameHeight - physicalViewSpaceFontSize) / 2
            ),
          });
        }
      }
      for (const child of frame.children) {
        renderFrameLabelAndChildren(child, depth + 1);
      }
    };

    // Use frameOutlineWidth from params
    ctx.strokeStyle = this.props.theme.selectionSecondaryColor;
    // minConfigSpaceWidthToRenderOutline is already calculated in params

    const renderSpecialFrameOutlines = (frame: FlamechartFrame, depth = 0) => {
      if (
        !this.props.selectedNode &&
        this.props.searchResults == null &&
        !this.props.commentedCellIds?.length
      )
        return;
      const width = frame.end - frame.start;
      const y = this.props.renderInverted ? this.configSpaceSize().y - 1 - depth : depth;
      const configSpaceBounds = new Rect(new Vec2(frame.start, y), new Vec2(width, 1));

      if (width < minConfigSpaceWidthToRenderOutline) return;
      if (configSpaceBounds.left() > this.props.configSpaceViewportRect.right()) return;
      if (configSpaceBounds.right() < this.props.configSpaceViewportRect.left()) return;
      if (configSpaceBounds.top() > this.props.configSpaceViewportRect.bottom()) return;

      if (configSpaceBounds.hasIntersectionWith(this.props.configSpaceViewportRect)) {
        const cellId = `${frame.node.frame.key}_${depth}_${frame.start.toFixed(3)}`;
        const frameHasComments = this.props.commentedCellIds?.includes(cellId);

        if (frameHasComments) {
          const physicalRectBounds = configToPhysical.transformRect(configSpaceBounds);
          commentedFrameBatch.rect({
            x: Math.round(physicalRectBounds.left() + frameOutlineWidth / 2),
            y: Math.round(physicalRectBounds.top() + frameOutlineWidth / 2),
            w: Math.round(Math.max(0, physicalRectBounds.width() - frameOutlineWidth)),
            h: Math.round(Math.max(0, physicalRectBounds.height() - frameOutlineWidth)),
          });
        }

        if (this.props.searchResults?.getMatchForFrame(frame.node.frame)) {
          const physicalRectBounds = configToPhysical.transformRect(configSpaceBounds);
          matchedFrameBatch.rect({
            x: Math.round(physicalRectBounds.left() + frameOutlineWidth / 2),
            y: Math.round(physicalRectBounds.top() + frameOutlineWidth / 2),
            w: Math.round(Math.max(0, physicalRectBounds.width() - frameOutlineWidth)),
            h: Math.round(Math.max(0, physicalRectBounds.height() - frameOutlineWidth)),
          });
        }

        if (this.props.selectedNode != null && frame.node.frame === this.props.selectedNode.frame) {
          const batch =
            frame.node === this.props.selectedNode
              ? directlySelectedOutlineBatch
              : indirectlySelectedOutlineBatch;

          const physicalRectBounds = configToPhysical.transformRect(configSpaceBounds);
          batch.rect({
            x: Math.round(physicalRectBounds.left() + 1 + frameOutlineWidth / 2),
            y: Math.round(physicalRectBounds.top() + 1 + frameOutlineWidth / 2),
            w: Math.round(Math.max(0, physicalRectBounds.width() - 2 - frameOutlineWidth)),
            h: Math.round(Math.max(0, physicalRectBounds.height() - 2 - frameOutlineWidth)),
          });
        }
      }
      for (const child of frame.children) {
        renderSpecialFrameOutlines(child, depth + 1);
      }
    };

    for (const frame of this.props.flamechart.getLayers()[0] || []) {
      renderSpecialFrameOutlines(frame);
    }

    for (const frame of this.props.flamechart.getLayers()[0] || []) {
      renderFrameLabelAndChildren(frame);
    }

    const theme = this.props.theme;

    matchedFrameBatch.fill(ctx, theme.searchMatchPrimaryColor);
    matchedTextHighlightBatch.fill(ctx, theme.searchMatchSecondaryColor);
    commentedFrameBatch.stroke(ctx, '#FFD700', frameOutlineWidth * 1.5);
    fadedLabelBatch.fill(ctx, theme.fgSecondaryColor);
    labelBatch.fill(
      ctx,
      this.props.searchResults != null ? theme.searchMatchTextColor : theme.fgPrimaryColor
    );
    indirectlySelectedOutlineBatch.stroke(ctx, theme.selectionSecondaryColor, frameOutlineWidth);
    directlySelectedOutlineBatch.stroke(ctx, theme.selectionPrimaryColor, frameOutlineWidth);

    // Draw hover outline using the target context
    if (this.hoveredLabel) {
      let color: string = theme.fgPrimaryColor;
      if (this.props.selectedNode === this.hoveredLabel.node) {
        color = theme.selectionPrimaryColor;
      }

      ctx.save(); // Save context state
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.strokeStyle = color;

      const physicalViewBounds = configToPhysical.transformRect(
        this.hoveredLabel.configSpaceBounds
      );
      ctx.strokeRect(
        Math.round(physicalViewBounds.left()),
        Math.round(physicalViewBounds.top()),
        Math.round(Math.max(0, physicalViewBounds.width())),
        Math.round(Math.max(0, physicalViewBounds.height()))
      );
      ctx.restore(); // Restore context state
    }
  }

  // Refactored time indicator rendering logic
  private _renderTimeIndicators(params: OverlayRenderParams) {
    const {
      ctx,
      physicalViewSize,
      configToPhysical,
      physicalViewSpaceFontSize,
      physicalViewSpaceFrameHeight,
      LABEL_PADDING_PX,
    } = params;

    const left = this.props.configSpaceViewportRect.left();
    const right = this.props.configSpaceViewportRect.right();

    // Calculation for interval (same as before)
    const logicalToConfig = (configToPhysical.inverted() || new AffineTransform()).times(
      this.logicalToPhysicalViewSpace()
    );
    const targetInterval = logicalToConfig.transformVector(new Vec2(200, 1)).x;
    const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));
    let interval = minInterval;
    if (targetInterval / interval > 5) {
      interval *= 5;
    } else if (targetInterval / interval > 2) {
      interval *= 2;
    }

    const theme = this.props.theme;
    const flamegraphTextColor = theme.flamegraphTextColor || theme.fgPrimaryColor;

    {
      const y = this.props.renderInverted ? physicalViewSize.y - physicalViewSpaceFrameHeight : 0;

      // Set font properties on the target context
      ctx.font = `${physicalViewSpaceFontSize}px/${physicalViewSpaceFrameHeight}px ${FontFamily.MONOSPACE}`;
      ctx.textBaseline = 'top'; // Ensure consistent baseline

      ctx.fillStyle = Color.fromCSSHex(theme.bgPrimaryColor).withAlpha(0.8).toCSS();
      ctx.fillRect(0, y, physicalViewSize.x, physicalViewSpaceFrameHeight);

      for (let x = Math.ceil(left / interval) * interval; x < right; x += interval) {
        const pos = Math.round(configToPhysical.transformPosition(new Vec2(x, 0)).x);
        const labelText = this.props.flamechart.formatValue(x);
        const textWidth = cachedMeasureTextWidth(ctx, labelText); // Use target context
        ctx.fillStyle = flamegraphTextColor;
        ctx.fillText(labelText, pos - textWidth - LABEL_PADDING_PX, y + LABEL_PADDING_PX);
        ctx.fillStyle = theme.fgSecondaryColor;
        ctx.fillRect(pos, 0, 1, physicalViewSize.y);
      }
    }
  }

  private renderOverlays() {
    const ctx = this.overlayCtx;
    if (!ctx) return;
    if (this.props.configSpaceViewportRect.isEmpty()) return;

    const physicalViewSize = this.physicalViewSize();
    const configToPhysical = this.configSpaceToPhysicalViewSpace();
    const physicalViewSpaceFontSize = FontSize.LABEL * window.devicePixelRatio;
    const physicalViewSpaceFrameHeight =
      this.LOGICAL_VIEW_SPACE_FRAME_HEIGHT * window.devicePixelRatio;
    const frameOutlineWidth = 2 * window.devicePixelRatio;

    // Calculate minimum widths using the component's overlayCtx
    ctx.font = `${physicalViewSpaceFontSize}px/${physicalViewSpaceFrameHeight}px ${FontFamily.MONOSPACE}`;
    ctx.textBaseline = 'alphabetic';
    const minWidthToRender = cachedMeasureTextWidth(ctx, 'M' + ELLIPSIS + 'M');
    const minConfigSpaceWidthToRender = (
      configToPhysical.inverseTransformVector(new Vec2(minWidthToRender, 0)) || new Vec2(0, 0)
    ).x;
    const minConfigSpaceWidthToRenderOutline = (
      configToPhysical.inverseTransformVector(new Vec2(1, 0)) || new Vec2(0, 0)
    ).x;
    const LABEL_PADDING_PX = 5 * window.devicePixelRatio;

    const params: OverlayRenderParams = {
      ctx,
      physicalViewSize,
      configToPhysical,
      physicalViewSpaceFontSize,
      physicalViewSpaceFrameHeight,
      minWidthToRender,
      minConfigSpaceWidthToRender,
      minConfigSpaceWidthToRenderOutline,
      LABEL_PADDING_PX,
      frameOutlineWidth,
    };

    ctx.clearRect(0, 0, physicalViewSize.x, physicalViewSize.y); // Clear the component's own canvas
    this._renderOverlayContent(params); // Draw onto the component's canvas
    this._renderTimeIndicators(params); // Draw time indicators onto the component's canvas
  }

  private updateConfigSpaceViewport() {
    if (!this.container) return;
    const { logicalSpaceViewportSize } = this.props;
    const bounds = this.container.getBoundingClientRect();
    const { width, height } = bounds;

    // Still initializing: don't resize yet
    if (width < 2 || height < 2) return;

    if (this.props.configSpaceViewportRect.isEmpty()) {
      const configSpaceViewportHeight = height / this.LOGICAL_VIEW_SPACE_FRAME_HEIGHT;
      if (this.props.renderInverted) {
        this.setConfigSpaceViewportRect(
          new Rect(
            new Vec2(0, this.configSpaceSize().y - configSpaceViewportHeight + 1),
            new Vec2(this.configSpaceSize().x, configSpaceViewportHeight)
          )
        );
      } else {
        this.setConfigSpaceViewportRect(
          new Rect(new Vec2(0, -1), new Vec2(this.configSpaceSize().x, configSpaceViewportHeight))
        );
      }
    } else if (
      !logicalSpaceViewportSize.equals(Vec2.zero) &&
      (logicalSpaceViewportSize.x !== width || logicalSpaceViewportSize.y !== height)
    ) {
      // Resize the viewport rectangle to match the window size aspect
      // ratio.
      this.setConfigSpaceViewportRect(
        this.props.configSpaceViewportRect.withSize(
          this.props.configSpaceViewportRect.size.timesPointwise(
            new Vec2(width / logicalSpaceViewportSize.x, height / logicalSpaceViewportSize.y)
          )
        )
      );
    }

    const newSize = new Vec2(width, height);
    if (!newSize.equals(logicalSpaceViewportSize)) {
      this.props.setLogicalSpaceViewportSize(newSize);
    }
  }

  onWindowResize = () => {
    this.updateConfigSpaceViewport();
    this.onBeforeFrame();
  };

  private renderRects() {
    if (!this.container) return;
    this.updateConfigSpaceViewport();

    if (this.props.configSpaceViewportRect.isEmpty()) return;

    this.props.canvasContext.renderBehind(this.container, () => {
      this.props.flamechartRenderer.render({
        physicalSpaceDstRect: this.physicalBounds(),
        configSpaceSrcRect: this.props.configSpaceViewportRect,
        renderOutlines: true,
      });
    });
  }

  // Inertial scrolling introduces tricky interaction problems.
  // Namely, if you start panning, and hit the edge of the scrollable
  // area, the browser continues to receive WheelEvents from inertial
  // scrolling. If we start zooming by holding Cmd + scrolling, then
  // release the Cmd key, this can cause us to interpret the incoming
  // inertial scrolling events as panning. To prevent this, we introduce
  // a concept of an "Interaction Lock". Once a certain interaction has
  // begun, we don't allow the other type of interaction to begin until
  // we've received two frames with no inertial wheel events. This
  // prevents us from accidentally switching between panning & zooming.
  private frameHadWheelEvent = false;
  private framesWithoutWheelEvents = 0;
  private interactionLock: 'pan' | 'zoom' | null = null;
  private maybeClearInteractionLock = () => {
    if (this.interactionLock) {
      if (!this.frameHadWheelEvent) {
        this.framesWithoutWheelEvents++;
        if (this.framesWithoutWheelEvents >= 2) {
          this.interactionLock = null;
          this.framesWithoutWheelEvents = 0;
        }
      }
      this.props.canvasContext.requestFrame();
    }
    this.frameHadWheelEvent = false;
  };

  private onBeforeFrame = () => {
    this.resizeOverlayCanvasIfNeeded();
    this.renderRects();
    this.renderOverlays();
    this.maybeClearInteractionLock();
  };

  private renderCanvas = () => {
    this.props.canvasContext.requestFrame();
  };

  private pan(logicalViewSpaceDelta: Vec2) {
    this.interactionLock = 'pan';

    const physicalDelta = this.logicalToPhysicalViewSpace().transformVector(logicalViewSpaceDelta);
    const configDelta = this.configSpaceToPhysicalViewSpace().inverseTransformVector(physicalDelta);

    if (this.hoveredLabel) {
      this.props.onNodeHover(null);
    }

    if (!configDelta) return;
    this.props.transformViewport(AffineTransform.withTranslation(configDelta));
  }

  private zoom(logicalViewSpaceCenter: Vec2, multiplier: number) {
    this.interactionLock = 'zoom';

    const physicalCenter =
      this.logicalToPhysicalViewSpace().transformPosition(logicalViewSpaceCenter);
    const configSpaceCenter =
      this.configSpaceToPhysicalViewSpace().inverseTransformPosition(physicalCenter);
    if (!configSpaceCenter) return;

    const zoomTransform = AffineTransform.withTranslation(configSpaceCenter.times(-1))
      .scaledBy(new Vec2(multiplier, 1))
      .translatedBy(configSpaceCenter);

    this.props.transformViewport(zoomTransform);
  }

  private lastDragPos: Vec2 | null = null;
  private mouseDownPos: Vec2 | null = null;
  private onMouseDown = (ev: ReactMouseEvent<HTMLDivElement>) => {
    this.mouseDownPos = this.lastDragPos = new Vec2(ev.clientX, ev.clientY);
    this.updateCursor();
    window.addEventListener('mouseup', this.onWindowMouseUp);
  };

  private onMouseDrag = (ev: ReactMouseEvent<HTMLDivElement>) => {
    if (!this.lastDragPos) return;
    const logicalMousePos = new Vec2(ev.clientX, ev.clientY);
    this.pan(this.lastDragPos.minus(logicalMousePos));
    this.lastDragPos = logicalMousePos;

    // When panning by scrolling, the element under
    // the cursor will change, so clear the hovered label.
    if (this.hoveredLabel) {
      this.props.onNodeHover(null);
    }
  };

  private onDblClick = (ev: ReactMouseEvent<HTMLDivElement>) => {
    if (this.hoveredLabel) {
      const hoveredBounds = this.hoveredLabel.configSpaceBounds;
      const viewportRect = new Rect(
        hoveredBounds.origin.minus(new Vec2(0, 1)),
        hoveredBounds.size.withY(this.props.configSpaceViewportRect.height())
      );
      this.props.setConfigSpaceViewportRect(viewportRect);
    }
  };

  private onClick = (ev: ReactMouseEvent<HTMLDivElement>) => {
    const logicalMousePos = new Vec2(ev.clientX, ev.clientY);
    const mouseDownPos = this.mouseDownPos;
    this.mouseDownPos = null;

    if (mouseDownPos && logicalMousePos.minus(mouseDownPos).length() > 5) {
      // If the cursor is more than 5 logical space pixels away from the mouse
      // down location, then don't interpret this event as a click.
      return;
    }

    if (this.hoveredLabel) {
      const frame = this.hoveredLabel.node.frame;
      const frameStart = this.hoveredLabel.frameStart;
      const depth = this.hoveredLabel.depth;
      const cellId = `${frame.key}_${depth}_${frameStart.toFixed(3)}`;
      this.props.onNodeSelect(this.hoveredLabel.node, cellId);
      this.renderCanvas();
    } else {
      this.props.onNodeSelect(null, null);
    }
  };

  private updateCursor() {
    if (this.lastDragPos) {
      document.body.style.cursor = 'grabbing';
      document.body.style.cursor = '-webkit-grabbing';
    } else {
      document.body.style.cursor = 'default';
    }
  }

  private onWindowMouseUp = (ev: MouseEvent) => {
    this.lastDragPos = null;
    this.updateCursor();
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  };

  private onMouseMove = (ev: ReactMouseEvent<HTMLDivElement>) => {
    this.updateCursor();
    if (this.lastDragPos) {
      ev.preventDefault();
      this.onMouseDrag(ev);
      return;
    }

    // Ensure the container exists and get its bounding rect
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();

    // Calculate mouse position relative to the container element
    const logicalViewSpaceMouse = new Vec2(ev.clientX - rect.left, ev.clientY - rect.top);

    const physicalViewSpaceMouse =
      this.logicalToPhysicalViewSpace().transformPosition(logicalViewSpaceMouse);
    const configSpaceMouse =
      this.configSpaceToPhysicalViewSpace().inverseTransformPosition(physicalViewSpaceMouse);

    if (!configSpaceMouse) return;

    const setHoveredLabel = (frame: FlamechartFrame, depth = 0) => {
      const width = frame.end - frame.start;
      const y = this.props.renderInverted ? this.configSpaceSize().y - 1 - depth : depth;
      const configSpaceBounds = new Rect(new Vec2(frame.start, y), new Vec2(width, 1));
      if (configSpaceMouse.x < configSpaceBounds.left()) return null;
      if (configSpaceMouse.x > configSpaceBounds.right()) return null;

      if (configSpaceBounds.contains(configSpaceMouse)) {
        this.hoveredLabel = {
          configSpaceBounds,
          node: frame.node,
          frameStart: frame.start,
          depth: depth,
        };
      }

      for (const child of frame.children) {
        setHoveredLabel(child, depth + 1);
      }
    };

    // This is a dumb hack to get around what appears to be a bug in
    // TypeScript's reachability analysis. If I do the this.hoveredLabel = null
    // in the outer function body, the code below accessing
    // this.hoveredLabel!.node inside of the `if (this.hoveredLabel) {`
    // complains that "no property node on never", indicating that it thinks
    // that codepath is unreachable.
    //
    // Because this.hoveredLabel is accessed in the bound function
    // setHoveredLabel, the codepath is obviously reachable, but the type
    // checker is confused about this for some reason.
    const clearHoveredLabel = () => {
      this.hoveredLabel = null;
    };
    clearHoveredLabel();

    for (const frame of this.props.flamechart.getLayers()[0] || []) {
      setHoveredLabel(frame);
    }

    // Calculate cellId and prepare payload if hoveredLabel exists
    if (this.hoveredLabel) {
      const frame = this.hoveredLabel.node.frame;
      const frameStart = this.hoveredLabel.frameStart;
      const depth = this.hoveredLabel.depth;
      const cellId = `${frame.key}_${depth}_${frameStart.toFixed(3)}`;

      const payload: HoverPayload = {
        node: this.hoveredLabel.node,
        event: ev,
        cellId: cellId,
        frameStart: frameStart,
        depth: depth,
      };
      this.props.onNodeHover(payload);
    } else {
      this.props.onNodeHover(null);
    }

    this.renderCanvas();
  };

  private onMouseLeave = (ev: ReactMouseEvent<HTMLDivElement>) => {
    this.hoveredLabel = null;
    this.props.onNodeHover(null);
    this.renderCanvas();
  };

  // Use native WheelEvent since this listener is attached manually
  private onWheel = (ev: WheelEvent) => {
    // Ensure the container exists before proceeding
    if (!this.container) return;

    // We still call preventDefault, but if the listener is passive,
    // this will cause a console warning and have no effect.
    ev.preventDefault();
    this.frameHadWheelEvent = true;

    const isZoom = ev.metaKey || ev.ctrlKey;

    let deltaY = ev.deltaY;
    let deltaX = ev.deltaX;
    // Use static property WheelEvent.DOM_DELTA_LINE
    if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaY *= this.LOGICAL_VIEW_SPACE_FRAME_HEIGHT;
      deltaX *= this.LOGICAL_VIEW_SPACE_FRAME_HEIGHT;
    }

    if (isZoom && this.interactionLock !== 'pan') {
      let multiplier = 1 + deltaY / 100;

      // On Chrome & Firefox, pinch-to-zoom maps to
      // WheelEvent + Ctrl Key. We'll accelerate it in
      // this case, since it feels a bit sluggish otherwise.
      if (ev.ctrlKey) {
        multiplier = 1 + deltaY / 40;
      }

      multiplier = clamp(multiplier, 0.1, 10.0);

      // Calculate mouse position relative to the container element
      const rect = this.container.getBoundingClientRect();
      const offsetX = ev.clientX - rect.left;
      const offsetY = ev.clientY - rect.top;

      // Use relative coordinates for zoom center
      this.zoom(new Vec2(offsetX, offsetY), multiplier);
    } else if (this.interactionLock !== 'zoom') {
      this.pan(new Vec2(deltaX, deltaY));
    }

    this.renderCanvas();
  };

  onWindowKeyPress = (ev: KeyboardEvent) => {
    // Add check for input/textarea focus
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
      return; // Ignore key presses within inputs
    }

    if (!this.container) return;
    const { width, height } = this.container.getBoundingClientRect();

    if (ev.key === '=' || ev.key === '+') {
      this.zoom(new Vec2(width / 2, height / 2), 0.5);
      ev.preventDefault();
    } else if (ev.key === '-' || ev.key === '_') {
      this.zoom(new Vec2(width / 2, height / 2), 2);
      ev.preventDefault();
    }

    // This check should now happen *after* the input focus check
    if (ev.ctrlKey || ev.shiftKey || ev.metaKey) return;

    // NOTE: We intentionally use ev.code rather than ev.key for
    // WASD in order to have the keys retain the same layout even
    // if the keyboard layout is not QWERTY.
    //
    // See: https://github.com/jlfwong/speedscope/pull/184
    if (ev.key === '0') {
      this.zoom(new Vec2(width / 2, height / 2), 1e9);
    } else if (ev.key === 'ArrowRight' || ev.code === 'KeyD') {
      this.pan(new Vec2(100, 0));
    } else if (ev.key === 'ArrowLeft' || ev.code === 'KeyA') {
      this.pan(new Vec2(-100, 0));
    } else if (ev.key === 'ArrowUp' || ev.code === 'KeyW') {
      this.pan(new Vec2(0, -100));
    } else if (ev.key === 'ArrowDown' || ev.code === 'KeyS') {
      this.pan(new Vec2(0, 100));
    } else if (ev.key === 'Escape') {
      // Keep escape for deselecting node, as the comment form handles its own escape
      this.props.onNodeSelect(null, null);
      this.renderCanvas();
    }
  };

  override shouldComponentUpdate() {
    return false;
  }
  override componentWillReceiveProps(nextProps: FlamechartPanZoomViewProps) {
    if (this.props.flamechart !== nextProps.flamechart) {
      this.hoveredLabel = null;
      this.renderCanvas();
    } else if (this.props.searchResults !== nextProps.searchResults) {
      this.renderCanvas();
    } else if (this.props.selectedNode !== nextProps.selectedNode) {
      this.renderCanvas();
    } else if (this.props.configSpaceViewportRect !== nextProps.configSpaceViewportRect) {
      this.renderCanvas();
    } else if (this.props.canvasContext !== nextProps.canvasContext) {
      if (this.props.canvasContext) {
        this.props.canvasContext.removeBeforeFrameHandler(this.onBeforeFrame);
      }
      if (nextProps.canvasContext) {
        nextProps.canvasContext.addBeforeFrameHandler(this.onBeforeFrame);
        nextProps.canvasContext.requestFrame();
      }
    }
  }
  override componentDidMount() {
    this.props.canvasContext.addBeforeFrameHandler(this.onBeforeFrame);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.onWindowKeyPress);
    // Manually add wheel listener with passive: false
    if (this.container) {
      this.container.addEventListener('wheel', this.onWheel as EventListener, { passive: false });
    }
  }
  override componentWillUnmount() {
    this.props.canvasContext.removeBeforeFrameHandler(this.onBeforeFrame);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.onWindowKeyPress);
    // Remove manually added wheel listener
    if (this.container) {
      this.container.removeEventListener('wheel', this.onWheel as EventListener);
    }
  }

  override render() {
    return (
      <div
        className="flex-1 flex-col relative overflow-hidden"
        onMouseDown={this.onMouseDown}
        onMouseMove={this.onMouseMove}
        onMouseLeave={this.onMouseLeave}
        onClick={this.onClick}
        onDoubleClick={this.onDblClick}
        ref={this.containerRef}
      >
        <canvas
          width={1}
          height={1}
          ref={this.overlayCanvasRef}
          className="w-full h-full absolute top-0 left-0 flamechart-overlay"
        />
      </div>
    );
  }
}

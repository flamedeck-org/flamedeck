import React, { useCallback } from "react";
import type { Vec2 } from "../../lib/speedscope-core/math";
import { useTheme } from "./themes/theme";

interface HovertipProps {
  containerSize: Vec2;
  offset: Vec2;
  children?: React.ReactNode;
}

export function Hovertip(props: HovertipProps) {
  const theme = useTheme();
  const { containerSize, offset } = props;
  const containerWidth = containerSize.x;
  const containerHeight = containerSize.y;

  const OFFSET_FROM_MOUSE = 7;

  const updateLocation = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;

      const clientRect = el.getBoundingClientRect();

      // Place the hovertip to the right of the cursor.
      let leftEdgeX = offset.x + OFFSET_FROM_MOUSE;

      // If this would cause it to overflow the container, align the right
      // edge of the hovertip with the right edge of the container.
      if (leftEdgeX + clientRect.width > containerWidth - 1) {
        leftEdgeX = containerWidth - clientRect.width - 1;

        // If aligning the right edge overflows the container, align the left edge
        // of the hovertip with the left edge of the container.
        if (leftEdgeX < 1) {
          leftEdgeX = 1;
        }
      }
      el.style.left = `${leftEdgeX}px`;

      // Place the tooltip below the cursor
      let topEdgeY = offset.y + OFFSET_FROM_MOUSE;

      // If this would cause it to overflow the container, place the hovertip
      // above the cursor instead. This intentionally differs from the horizontal
      // axis logic to avoid the cursor being in the middle of a hovertip when
      // possible.
      if (topEdgeY + clientRect.height > containerHeight - 1) {
        topEdgeY = offset.y - clientRect.height - 1;

        // If placing the hovertip above the cursor overflows the container, align
        // the top edge of the hovertip with the top edge of the container.
        if (topEdgeY < 1) {
          topEdgeY = 1;
        }
      }
      el.style.top = `${topEdgeY}px`;
    },
    [containerWidth, containerHeight, offset.x, offset.y]
  );

  return (
    <div
      className="absolute p-0.5 text-xs font-mono max-w-xs pointer-events-none select-none z-50 shadow-md"
      style={{
        backgroundColor: theme.bgPrimaryColor,
        borderColor: theme.fgPrimaryColor,
        color: theme.fgPrimaryColor,
        borderWidth: "1px",
        borderStyle: "solid",
      }}
      ref={updateLocation}
    >
      <div className="truncate whitespace-nowrap overflow-hidden px-0.5 max-w-xs">
        {props.children}
      </div>
    </div>
  );
}

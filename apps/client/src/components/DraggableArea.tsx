import React from 'react';
import { cn } from '@/lib/utils';

interface DraggableAreaProps {
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  children: React.ReactNode;
  className?: string; // Allow passing additional classes
  draggingClassName?: string; // Customize dragging style
  baseClassName?: string; // Customize base style
}

const defaultDraggingClassName =
  'outline-dashed outline-2 outline-offset-[-4px] outline-primary rounded-lg';
const defaultBaseClassName = ''; // No specific base style by default, rely on layout

export function DraggableArea({
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging,
  children,
  className,
  draggingClassName = defaultDraggingClassName,
  baseClassName = defaultBaseClassName,
}: DraggableAreaProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'transition-all', // Add transition for smoother visual feedback
        isDragging ? draggingClassName : baseClassName,
        className // Merge with any additional classes passed
      )}
    >
      {children}
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  frameKey?: string | number | null;
  children: React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, 
  y, 
  onClose, 
  frameKey, 
  children 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close the menu if clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Position the menu correctly based on viewport boundaries
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });
  
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      
      setAdjustedPosition({
        x: Math.min(x, maxX),
        y: Math.min(y, maxY)
      });
    }
  }, [x, y]);

  return createPortal(
    <div 
      ref={menuRef}
      className="absolute z-50 min-w-[160px] bg-popover text-popover-foreground rounded-md shadow-md border border-border py-1 text-sm"
      style={{ 
        left: adjustedPosition.x, 
        top: adjustedPosition.y 
      }}
    >
      {children}
    </div>,
    document.body
  );
};

export const ContextMenuItem: React.FC<{
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ onClick, icon, children }) => {
  return (
    <div 
      className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      <span>{children}</span>
    </div>
  );
};

export const ContextMenuDivider: React.FC = () => (
  <div className="h-px bg-border my-1" />
);

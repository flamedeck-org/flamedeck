import React from 'react';
import { cn } from '@/lib/utils'; // Import cn for conditional classes

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string; // Allow passing additional classes
}

const PageLayout: React.FC<PageLayoutProps> = ({ children, className }) => {
  // Changed to a flex column that takes minimum full height to allow children to grow
  return <div className={cn('flex flex-col min-h-full w-full', className)}>{children}</div>;
};

export default PageLayout;

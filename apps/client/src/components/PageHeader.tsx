import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode; // Allow string or Skeleton
  subtitle?: React.ReactNode; // Optional subtitle node
  actions?: React.ReactNode; // Optional action buttons/links
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex justify-between items-start pb-4 mb-6 border-b">
      {/* Container for title and subtitle */}
      <div>
        {/* Allow title to be text or a skeleton */}
        {typeof title === 'string' ? (
          <h1 className="text-2xl font-bold">{title}</h1>
        ) : (
          title // Render Skeleton directly if passed
        )}
        {/* Render subtitle below title if provided */}
        {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div>{actions}</div>} {/* Render actions if provided */}
    </div>
  );
};

export default PageHeader;

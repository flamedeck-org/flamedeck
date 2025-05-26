import * as React from 'react';

interface PageHeaderProps {
  title: React.ReactNode; // Allow string or Skeleton
  subtitle?: React.ReactNode; // Optional subtitle node
  actions?: React.ReactNode; // Optional action buttons/links
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 pb-4 mb-6 border-b">
      {/* Container for title and subtitle */}
      <div className="min-w-0 flex-1">
        {/* Allow title to be text or a skeleton */}
        {typeof title === 'string' ? (
          <h1 className="text-2xl font-bold truncate">{title}</h1>
        ) : (
          title // Render Skeleton directly if passed
        )}
        {/* Render subtitle below title if provided */}
        {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {/* Actions container - stacks on mobile, aligns right on desktop */}
      {actions && (
        <div className="flex-shrink-0 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;

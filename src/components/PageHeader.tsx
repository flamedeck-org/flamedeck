import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode; // Allow string or Skeleton
  actions?: React.ReactNode; // Optional action buttons/links
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, actions }) => {
  return (
    <div className="flex justify-between items-center pb-4 mb-6 border-b">
      {/* Allow title to be text or a skeleton */} 
      {typeof title === 'string' ? (
        <h1 className="text-2xl font-bold">{title}</h1>
      ) : (
        title // Render Skeleton directly if passed
      )}
      {actions && <div>{actions}</div>} {/* Render actions if provided */}
    </div>
  );
};

export default PageHeader; 
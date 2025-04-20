import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  // This div provides the standard vertical spacing for page content
  return <div className="space-y-6 w-full">{children}</div>;
};

export default PageLayout; 
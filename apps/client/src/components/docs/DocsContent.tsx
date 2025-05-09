import { memo, type ReactNode } from 'react';

interface DocsContentProps {
  children: ReactNode;
}

function DocsContent({ children }: DocsContentProps) {
  return <div className="prose dark:prose-invert max-w-none">{children}</div>;
}

export default memo(DocsContent);

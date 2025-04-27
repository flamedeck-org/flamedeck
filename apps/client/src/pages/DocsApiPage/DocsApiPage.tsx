import { memo } from 'react';
import DocsContent from '@/docs/api-upload-trace.mdx'; // Import the MDX content
// DocsLayout is now handled by the router

function DocsApiPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <DocsContent />
    </div>
  );
}

export default memo(DocsApiPage); 
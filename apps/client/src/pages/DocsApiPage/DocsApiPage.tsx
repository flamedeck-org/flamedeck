import { memo } from 'react';
import DocsContent from '@/docs/api-upload-trace.mdx'; // Import the MDX content
import DocsLayout from '@/components/DocsLayout/DocsLayout'; // Import the layout

function DocsApiPage() {
  return (
    <DocsLayout>
      <div className="prose dark:prose-invert mx-auto max-w-4xl p-8">
        {/* Render the imported MDX component */}
        <DocsContent />
      </div>
    </DocsLayout>
  );
}

export default memo(DocsApiPage); 
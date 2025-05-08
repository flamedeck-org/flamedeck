import React from 'react';
// Remove incorrect import: import { MdxComponent } from '@/components/mdx/MdxComponent';
import GettingStartedContent from '../docs/getting-started.mdx';

// MDX content is imported as a component directly

export default function DocsGettingStartedPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      {/* Render the imported MDX component directly */}
      <GettingStartedContent />
    </div>
  );
}

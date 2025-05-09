import { memo } from 'react';
import SharedPageSEO from '@/components/seo/SharedPageSEO'; // Import the more generic SEO component

interface DocsPageSEOProps {
  title: string; // The main part of the title for the docs page, e.g., "API Keys"
  description: string;
  path: string; // The specific path for the doc page, e.g., "/docs/api-keys"
}

const DOCS_TITLE_SUFFIX = ' - Flamedeck Docs';

// This component now acts as a specialized wrapper around SharedPageSEO for docs
function DocsPageSEO({ title, description, path }: DocsPageSEOProps) {
  return (
    <SharedPageSEO
      pageTitle={title}
      description={description}
      path={path}
      ogType="article"
      titleSuffix={DOCS_TITLE_SUFFIX}
    />
  );
}

export default memo(DocsPageSEO);

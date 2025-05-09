import { Helmet } from 'react-helmet-async';
import NpmUploadContent from '@/docs/npm-upload.mdx';
import DocsContent from '@/components/docs/DocsContent';

function DocsNpmUploadPage() {
  return (
    <>
      <Helmet>
        <title>NPM Package Upload - Flamedeck Docs</title>
        <meta
          name="description"
          content="Discover how to use the Flamedeck NPM package to programmatically upload performance traces from your JavaScript or TypeScript projects."
        />
        <meta property="og:title" content="NPM Package Upload - Flamedeck Docs" />
        <meta
          property="og:description"
          content="Discover how to use the Flamedeck NPM package to programmatically upload performance traces from your JavaScript or TypeScript projects."
        />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://your-flamedeck-domain.com/docs/npm-upload" />{' '}
        {/* TODO: Replace with actual domain */}
        {/* <meta property="og:image" content="YOUR_FLAMEDECK_DOCS_IMAGE_URL_HERE.png" /> */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@flamedeckapp" /> {/* Assuming same as homepage */}
        <meta name="twitter:title" content="NPM Package Upload - Flamedeck Docs" />
        <meta
          name="twitter:description"
          content="Discover how to use the Flamedeck NPM package to programmatically upload performance traces from your JavaScript or TypeScript projects."
        />
        {/* <meta name="twitter:image" content="YOUR_FLAMEDECK_DOCS_IMAGE_URL_HERE.png" /> */}
      </Helmet>
      <DocsContent>
        <NpmUploadContent />
      </DocsContent>
    </>
  );
}

export default DocsNpmUploadPage;

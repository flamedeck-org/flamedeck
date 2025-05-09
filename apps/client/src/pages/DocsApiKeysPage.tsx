import { Helmet } from 'react-helmet-async';
import ApiKeysContent from '../docs/api-keys.mdx';
import DocsContent from '@/components/docs/DocsContent';

export default function DocsApiKeysPage() {
  return (
    <>
      <Helmet>
        <title>API Keys - Flamedeck Docs</title>
        <meta
          name="description"
          content="Learn how to get an API key and understand the necessary scopes for interacting with the FlameDeck API."
        />
        <meta property="og:title" content="API Keys - Flamedeck Docs" />
        <meta
          property="og:description"
          content="Learn how to get an API key and understand the necessary scopes for interacting with the FlameDeck API."
        />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://www.flamedeck.com/docs/api-keys" />
        {/* TODO: Replace with actual domain */}
        {/* <meta property="og:image" content="YOUR_FLAMEDECK_DOCS_IMAGE_URL_HERE.png" /> */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@flamedeckapp" /> {/* Assuming same as homepage */}
        <meta name="twitter:title" content="API Keys - Flamedeck Docs" />
        <meta
          name="twitter:description"
          content="Learn how to get an API key and understand the necessary scopes for interacting with the FlameDeck API."
        />
        {/* <meta name="twitter:image" content="YOUR_FLAMEDECK_DOCS_IMAGE_URL_HERE.png" /> */}
      </Helmet>
      <DocsContent>
        <ApiKeysContent />
      </DocsContent>
    </>
  );
}

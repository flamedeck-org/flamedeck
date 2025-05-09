import { Helmet } from 'react-helmet-async';
import CliUploadContent from '@/docs/cli-upload.mdx';
import DocsContent from '@/components/docs/DocsContent';

function DocsCliUploadPage() {
  return (
    <>
      <Helmet>
        <title>CLI Upload - Flamedeck Docs</title>
        <meta
          name="description"
          content="Learn how to upload traces to Flamedeck using our Command Line Interface (CLI). Streamline your workflow with CLI uploads."
        />
        <meta property="og:title" content="CLI Upload - Flamedeck Docs" />
        <meta
          property="og:description"
          content="Learn how to upload traces to Flamedeck using our Command Line Interface (CLI). Streamline your workflow with CLI uploads."
        />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://your-flamedeck-domain.com/docs/cli-upload" />{' '}
        {/* TODO: Replace with actual domain */}
        {/* <meta property="og:image" content="YOUR_FLAMEDECK_DOCS_IMAGE_URL_HERE.png" /> */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@flamedeckapp" /> {/* Assuming same as homepage */}
        <meta name="twitter:title" content="CLI Upload - Flamedeck Docs" />
        <meta
          name="twitter:description"
          content="Learn how to upload traces to Flamedeck using our Command Line Interface (CLI). Streamline your workflow with CLI uploads."
        />
        {/* <meta name="twitter:image" content="YOUR_FLAMEDECK_DOCS_IMAGE_URL_HERE.png" /> */}
      </Helmet>
      <DocsContent>
        <CliUploadContent />
      </DocsContent>
    </>
  );
}

export default DocsCliUploadPage;

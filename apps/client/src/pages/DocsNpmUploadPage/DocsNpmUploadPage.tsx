import NpmUploadContent from '@/docs/npm-upload.mdx';
import DocsContent from '@/components/docs/DocsContent';
import DocsPageSEO from '@/components/docs/DocsPageSEO';

function DocsNpmUploadPage() {
  return (
    <>
      <DocsPageSEO
        title="NPM Package Upload"
        description="Discover how to use the Flamedeck NPM package to programmatically upload performance traces from your JavaScript or TypeScript projects."
        path="/docs/npm-upload"
      />
      <DocsContent>
        <NpmUploadContent />
      </DocsContent>
    </>
  );
}

export default DocsNpmUploadPage;

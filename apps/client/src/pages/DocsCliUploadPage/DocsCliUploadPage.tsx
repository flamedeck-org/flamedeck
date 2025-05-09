import CliUploadContent from '@/docs/cli-upload.mdx';
import DocsContent from '@/components/docs/DocsContent';
import DocsPageSEO from '@/components/docs/DocsPageSEO';

function DocsCliUploadPage() {
  return (
    <>
      <DocsPageSEO
        title="CLI Upload"
        description="Learn how to upload traces to Flamedeck using our Command Line Interface (CLI). Streamline your workflow with CLI uploads."
        path="/docs/cli-upload"
      />
      <DocsContent>
        <div className="prose dark:prose-invert max-w-none">
          <CliUploadContent />
        </div>
      </DocsContent>
    </>
  );
}

export default DocsCliUploadPage;

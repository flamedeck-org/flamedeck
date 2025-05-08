import React from "react";
import CliUploadContent from "@/docs/cli-upload.mdx";

// It is assumed that your MDX loader setup will provide the necessary components
// or context for rendering things like headings, code blocks, etc.
// This component simply renders the imported MDX content.

function DocsCliUploadPage() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <CliUploadContent />
    </div>
  );
}

export default DocsCliUploadPage;

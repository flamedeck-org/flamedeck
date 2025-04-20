import React from "react";
import Layout from "@/components/Layout"; // Use the main Layout
import PageHeader from "@/components/PageHeader";
import AuthGuard from "@/components/AuthGuard";
import UploadDialog from "@/components/UploadDialog";

const Upload: React.FC = () => {
  return (
    <AuthGuard>
      <Layout> 
        <PageHeader title="Upload Trace" />
        <UploadDialog />
      </Layout>
    </AuthGuard>
  );
};

export default Upload;

import React from "react";
import Layout from "@/components/Layout"; // Use the main Layout
import PageHeader from "@/components/PageHeader";
import AuthGuard from "@/components/AuthGuard";
import { UploadDialog } from "@/components/UploadDialog";
import { useLocation } from 'react-router-dom'; // <-- Import useLocation

const Upload: React.FC = () => {
  // Get location state
  const location = useLocation();
  const targetFolderId = location.state?.targetFolderId || null;

  return (
    <AuthGuard>
      <Layout> 
        <PageHeader title="Upload Trace" />
        <UploadDialog initialFolderId={targetFolderId} />
      </Layout>
    </AuthGuard>
  );
};

export default Upload;

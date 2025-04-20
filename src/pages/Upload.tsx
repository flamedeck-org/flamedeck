
import React from "react";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import UploadDialog from "@/components/UploadDialog";

const Upload: React.FC = () => {
  return (
    <AuthGuard>
      <Layout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-6">Upload Trace</h1>
          <UploadDialog />
        </div>
      </Layout>
    </AuthGuard>
  );
};

export default Upload;

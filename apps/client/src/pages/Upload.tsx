import React from 'react';
import Layout from '@/components/Layout'; // Use the main Layout
import PageHeader from '@/components/PageHeader';
import AuthGuard from '@/components/AuthGuard';
import { UploadDialog } from '@/components/UploadDialog';
import { useLocation } from 'react-router-dom'; // <-- Import useLocation
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // <-- Import Card components

const Upload: React.FC = () => {
  // Get location state
  const location = useLocation();
  const targetFolderId = location.state?.targetFolderId || null;

  return (
    <AuthGuard>
      <Layout>
        <PageHeader title="Upload Trace" />
        {/* Wrap UploadDialog in Card for proper layout on this page */}
        <Card className="w-full max-w-2xl mx-auto mt-6">
          {/* <CardHeader> - Optional: Can add title back here if desired */}
          {/*   <CardTitle className="text-2xl">Upload Performance Trace</CardTitle> */}
          {/* </CardHeader> */}
          <CardContent className="pt-6">
            {' '}
            {/* Add padding */}
            <UploadDialog initialFolderId={targetFolderId} />
          </CardContent>
        </Card>
      </Layout>
    </AuthGuard>
  );
};

export default Upload;

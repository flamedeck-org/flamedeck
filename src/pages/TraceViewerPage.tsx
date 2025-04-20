import React from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import SpeedscopeViewer from "@/components/SpeedscopeViewer";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getTraceBlob } from "@/lib/storage";

const TraceViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { toast } = useToast();

  const blobPath = location.state?.blobPath as string | undefined;

  const { 
    data: traceBlobData, 
    isLoading: isLoadingBlob, 
    error: blobError 
  } = useQuery<{
    data: ArrayBuffer;
    fileName: string;
  }, Error>({
    queryKey: ['traceBlob', id, blobPath],
    queryFn: () => {
      if (!blobPath) throw new Error("Blob path is required");
      return getTraceBlob(blobPath);
    },
    enabled: !!blobPath,
    staleTime: Infinity,
    retry: false,
  });

  return (
    <AuthGuard>
      <Layout noPadding={true}>
        {isLoadingBlob && (
          <div className="flex items-center justify-center h-full w-full">
            <p>Loading trace data...</p>
          </div>
        )}

        {!isLoadingBlob && blobError && (
          <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center">
            <h2 className="text-xl font-semibold text-destructive">Error Loading Trace Data</h2>
            <p className="text-destructive mt-2">{blobError.message}</p>
            {id && <Link to={`/traces/${id}`}><Button variant="outline" className="mt-4">Back to Details</Button></Link>}
          </div>
        )}

        {!isLoadingBlob && !blobError && traceBlobData && (
          <div className="h-full w-full">
            <SpeedscopeViewer 
              traceData={traceBlobData.data}
              fileName={traceBlobData.fileName}
            />
          </div>
        )}

        {!isLoadingBlob && !blobError && !traceBlobData && (
           <div className="flex items-center justify-center h-full w-full">
              <p>Trace data could not be loaded (missing path or data).</p>
           </div>
        )}
      </Layout>
    </AuthGuard>
  );
};

export default TraceViewerPage; 
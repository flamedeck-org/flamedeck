import React from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import SpeedscopeViewer from "@/components/SpeedscopeViewer";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { traceApi } from "@/lib/api";
import { getTraceBlob } from "@/lib/storage";
import { TraceMetadata } from "@/types";

const TraceViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { 
    data: traceMetadata, 
    isLoading: isLoadingMetadata, 
    error: metadataError 
  } = useQuery<ApiResponse<TraceMetadata>, Error>({
    queryKey: ['traceMetadata', id],
    queryFn: () => {
      if (!id) throw new Error("Trace ID is required");
      return traceApi.getTrace(id);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const blobPath = traceMetadata?.data?.blob_path;

  const { 
    data: traceBlobData, 
    isLoading: isLoadingBlob, 
    error: blobError 
  } = useQuery<{
    data: ArrayBuffer;
    fileName: string;
  }, Error>({
    queryKey: ['traceBlob', blobPath],
    queryFn: () => {
      if (!blobPath) throw new Error("Blob path is required");
      return getTraceBlob(blobPath);
    },
    enabled: !!blobPath,
    staleTime: Infinity,
    retry: false,
  });

  const isLoading = isLoadingMetadata || isLoadingBlob;
  const displayError = blobError || metadataError;

  const displayFileName = traceBlobData?.fileName || traceMetadata?.data?.scenario || id;

  const headerActions = (
    <Link to={id ? `/traces/${id}` : '/traces'}>
      <Button variant="outline" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Details
      </Button>
    </Link>
  );

  return (
    <AuthGuard>
      <Layout noPadding={true}>
        {isLoading && (
          <div className="flex items-center justify-center h-full w-full">
            <p>Loading trace data...</p>
          </div>
        )}

        {!isLoading && displayError && (
          <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center">
            <h2 className="text-xl font-semibold text-destructive">Error Loading Trace Data</h2>
            <p className="text-destructive mt-2">{displayError.message}</p>
            {id && <Link to={`/traces/${id}`}><Button variant="outline" className="mt-4">Back to Details</Button></Link>}
          </div>
        )}

        {!isLoading && !displayError && traceBlobData && (
          <div className="h-full w-full">
            <SpeedscopeViewer 
              traceData={traceBlobData.data}
              fileName={traceBlobData.fileName}
            />
          </div>
        )}

        {!isLoading && !displayError && !traceBlobData && (
           <div className="flex items-center justify-center h-full w-full">
              <p>Trace data could not be loaded (missing path or data).</p>
           </div>
        )}
      </Layout>
    </AuthGuard>
  );
};

export default TraceViewerPage; 
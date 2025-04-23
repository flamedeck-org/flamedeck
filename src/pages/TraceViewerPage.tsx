import React, { useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import SpeedscopeViewer, { SpeedscopeViewType } from "@/components/SpeedscopeViewer";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getTraceBlob } from "@/lib/storage";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from 'lucide-react';

// Define a fallback component to display on error
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center h-full w-full p-4 text-center border border-destructive bg-destructive/10 text-destructive">
      <h2 className="text-xl font-semibold">Something went wrong rendering the trace viewer:</h2>
      <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
      <Button variant="outline" className="mt-4" onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

const TraceViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [selectedView, setSelectedView] = useState<SpeedscopeViewType>('time_ordered');

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
      <Layout noPadding isProfileView>
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
          <div className="h-full w-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0 border-b z-[1] bg-background px-4">
              <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as SpeedscopeViewType)} className="inline-block">
                <TabsList className="inline-flex rounded-none bg-transparent text-foreground p-0 border-none">
                  <TabsTrigger value="time_ordered" className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground">Time Ordered</TabsTrigger>
                  <TabsTrigger value="left_heavy" className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground">Left Heavy</TabsTrigger>
                  <TabsTrigger value="sandwich" className="px-6 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=inactive]:text-muted-foreground">Sandwich</TabsTrigger>
                </TabsList>
              </Tabs>
              {id && (
                <Link to={`/traces/${id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Details
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex-grow overflow-hidden relative">
              <ErrorBoundary
                FallbackComponent={ErrorFallback}
                onReset={() => {
                  console.log("Attempting to reset Speedscope viewer boundary...");
                }}
              >
                <SpeedscopeViewer 
                  traceData={traceBlobData.data}
                  fileName={traceBlobData.fileName}
                  view={selectedView}
                />
              </ErrorBoundary>
            </div>
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
import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import SpeedscopeViewer from "@/components/SpeedscopeViewer";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { traceApi } from "@/lib/api";

const TraceViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { 
    data: traceBlobData, 
    isLoading: loadingTraceData, 
    error: traceDataError 
  } = useQuery<{
    data: string | ArrayBuffer;
    fileName: string;
  }, Error>({
    queryKey: ['traceData', id],
    queryFn: () => {
      if (!id) throw new Error("Trace ID is required");
      return traceApi.getTraceDataBlob(id);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  return (
    <AuthGuard>
      <Layout noPadding={true}>
        {loadingTraceData && (
          <div className="flex items-center justify-center h-full w-full">
            <Skeleton className="h-3/4 w-3/4" />
          </div>
        )}

        {traceDataError && (
          <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center">
            <h2 className="text-xl font-semibold text-destructive">Error Loading Trace Data</h2>
            <p className="text-destructive mt-2">{traceDataError.message}</p>
            {id && <Link to={`/traces/${id}`}><Button variant="outline" className="mt-4">Back to Details</Button></Link>}
          </div>
        )}

        {!loadingTraceData && !traceDataError && traceBlobData && (
          <div className="h-full w-full">
            <SpeedscopeViewer 
              traceData={traceBlobData.data} 
              fileName={traceBlobData.fileName}
            />
          </div>
        )}

        {!loadingTraceData && !traceDataError && !traceBlobData && (
           <div className="flex items-center justify-center h-full w-full">
              <p>Trace data not available.</p>
           </div>
        )}
      </Layout>
    </AuthGuard>
  );
};

export default TraceViewerPage; 
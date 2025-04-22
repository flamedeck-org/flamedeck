import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Link, useNavigate } from "react-router-dom";
import { formatBytes, formatDate } from "@/lib/utils";
import { traceApi, PaginatedTracesResponse } from "@/lib/api";
import { TraceMetadata } from "@/types";
import { FileJson, UploadCloud, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageLayout from "./PageLayout";
import PageHeader from "./PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TRACE_LIST_PAGE_SIZE = 10;

const TraceList = () => {
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: queryData, isLoading, error } = useQuery<PaginatedTracesResponse, Error>({
    queryKey: ["traces", page],
    queryFn: async () => {
      const response = await traceApi.getTraces(page, TRACE_LIST_PAGE_SIZE);
      if (response.error) {
        toast({
          title: "Error loading traces",
          description: response.error,
          variant: "destructive",
        });
        throw new Error(response.error);
      }
      return response.data || { traces: [], totalCount: 0 };
    },
  });

  const traces = queryData?.traces || [];
  const totalCount = queryData?.totalCount || 0;

  const deleteMutation = useMutation({
    mutationFn: (traceId: string) => traceApi.deleteTrace(traceId),
    onSuccess: () => {
      toast({
        title: "Trace deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
    },
    onError: (error) => {
      toast({
        title: "Error deleting trace",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadAction = (
    <Link to="/upload">
      <Button size="sm">
        <UploadCloud className="mr-2 h-4 w-4" /> Upload New Trace
      </Button>
    </Link>
  );

  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader 
          title={<Skeleton className="h-8 w-48" />} 
          actions={<Skeleton className="h-9 w-36 rounded-md" />} 
        />
        <div className="border rounded-lg p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="animate-pulse bg-muted h-12 rounded" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Error loading traces</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / TRACE_LIST_PAGE_SIZE);

  if (!isLoading && totalCount === 0 && !error) {
    return (
      <PageLayout>
        <PageHeader title="Performance Traces" actions={uploadAction} />
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <FileJson className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No traces found</h3>
            <p className="text-muted-foreground mb-6">
              Upload your first performance trace to get started
            </p>
            <Link to="/upload">
              <Button size="sm"><UploadCloud className="mr-2 h-4 w-4" /> Upload Trace</Button>
            </Link>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Performance Traces" actions={uploadAction} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Scenario</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {traces.map((trace: TraceMetadata) => (
                <TableRow 
                  key={trace.id} 
                  onClick={() => navigate(`/traces/${trace.id}`)} 
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium pl-6 py-3">{trace.scenario || "N/A"}</TableCell>
                  <TableCell className="py-3">{trace.branch || "N/A"}</TableCell>
                  <TableCell className="font-mono text-xs py-3">
                    {trace.commit_sha ? trace.commit_sha.substring(0, 7) : "N/A"}
                  </TableCell>
                  <TableCell className="py-3">{trace.device_model || "N/A"}</TableCell>
                  <TableCell className="py-3">{formatDuration(trace.duration_ms)}</TableCell>
                  <TableCell className="py-3">{formatDate(trace.uploaded_at)}</TableCell>
                  <TableCell className="text-right pr-6 py-3">
                    <div onClick={(e) => e.stopPropagation()} className="inline-block">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the trace{' '}
                              <strong>{trace.scenario || `ID: ${trace.id.substring(0, 7)}`}</strong>{' '}
                              and all associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(trace.id)}
                              disabled={deleteMutation.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="pt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(Math.max(0, page - 1))}
                  className={page === 0 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink 
                    isActive={page === i} 
                    onClick={() => setPage(i)}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </PageLayout>
  );
};

// Helper function to format duration in ms to a readable string
const formatDuration = (ms: number | undefined): string => {
  if (ms === undefined) return "Unknown";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export default TraceList;

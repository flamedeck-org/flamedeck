
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Link } from "react-router-dom";
import { formatBytes, formatDate } from "@/lib/utils";
import { traceApi } from "@/lib/api";
import { TraceMetadata } from "@/types";
import { FileJson } from "lucide-react";

const TraceList = () => {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data: traces, isLoading, error } = useQuery({
    queryKey: ["traces", page],
    queryFn: async () => {
      const response = await traceApi.getTraces(page, pageSize);
      if (response.error) {
        toast({
          title: "Error loading traces",
          description: response.error,
          variant: "destructive",
        });
        throw new Error(response.error);
      }
      return response.data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Performance Traces</h2>
          <div className="animate-pulse bg-muted h-10 w-32 rounded"></div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted h-12 rounded"></div>
            ))}
          </div>
        </div>
      </div>
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

  const totalPages = Math.ceil((traces?.length || 0) / pageSize);

  if (!traces || traces.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Performance Traces</h2>
          <Link to="/upload">
            <Button>Upload New Trace</Button>
          </Link>
        </div>

        <div className="border rounded-lg p-12 text-center">
          <FileJson className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No traces found</h3>
          <p className="text-muted-foreground mb-6">
            Upload your first performance trace to get started
          </p>
          <Link to="/upload">
            <Button>Upload Trace</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Performance Traces</h2>
        <Link to="/upload">
          <Button>Upload New Trace</Button>
        </Link>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scenario</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.map((trace: TraceMetadata) => (
              <TableRow key={trace.id}>
                <TableCell className="font-medium">{trace.scenario || "N/A"}</TableCell>
                <TableCell>{trace.branch || "N/A"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {trace.commit_sha ? trace.commit_sha.substring(0, 7) : "N/A"}
                </TableCell>
                <TableCell>{trace.device_model || "N/A"}</TableCell>
                <TableCell>{formatDuration(trace.duration_ms)}</TableCell>
                <TableCell>{formatDate(trace.uploaded_at)}</TableCell>
                <TableCell>
                  <Link to={`/traces/${trace.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
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
      )}
    </div>
  );
};

// Helper function to format duration in ms to a readable string
const formatDuration = (ms: number | undefined): string => {
  if (ms === undefined) return "Unknown";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export default TraceList;

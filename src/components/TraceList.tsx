
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TraceMetadata } from "@/types";
import { traceApi } from "@/lib/api";

const TraceList: React.FC = () => {
  const [traces, setTraces] = useState<TraceMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Load traces on initial render
  useEffect(() => {
    fetchTraces();
  }, []);

  const fetchTraces = async () => {
    try {
      setLoading(true);
      const response = await traceApi.getTraces(page);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (response.data) {
        if (page === 0) {
          setTraces(response.data);
        } else {
          setTraces((prev) => [...prev, ...response.data]);
        }
        setHasMore(response.data.length === 20);
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setPage((prev) => prev + 1);
    fetchTraces();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const filteredTraces = traces.filter((trace) => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    return (
      trace.commit_sha.toLowerCase().includes(term) ||
      trace.branch.toLowerCase().includes(term) ||
      trace.scenario.toLowerCase().includes(term) ||
      trace.device_model.toLowerCase().includes(term)
    );
  });

  if (loading && traces.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Traces</h2>
          <div className="animate-pulse-slow bg-muted h-9 w-72 rounded"></div>
        </div>
        
        <div className="border rounded-md">
          <div className="border-b bg-muted/50 p-4">
            <div className="animate-pulse-slow bg-muted h-6 w-full"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border-b last:border-b-0">
              <div className="space-y-2">
                <div className="animate-pulse-slow bg-muted h-5 w-full"></div>
                <div className="animate-pulse-slow bg-muted h-4 w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-destructive">Error loading traces: {error}</p>
        <Button onClick={() => { setError(null); fetchTraces(); }}>
          Try Again
        </Button>
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="text-center py-12 space-y-6">
        <div>
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-medium">No traces found</h3>
          <p className="text-muted-foreground">
            Upload your first trace to get started
          </p>
        </div>
        <Link to="/upload">
          <Button>Upload Your First Trace</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h2 className="text-2xl font-bold">My Traces</h2>
        <Input
          type="text"
          placeholder="Search by commit, branch, scenario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Scenario</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTraces.map((trace) => (
              <TableRow key={trace.id}>
                <TableCell>
                  <Link
                    to={`/traces/${trace.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {formatDate(trace.uploaded_at)}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">
                    {trace.commit_sha.slice(0, 7)}
                  </span>
                </TableCell>
                <TableCell>{trace.scenario}</TableCell>
                <TableCell>{trace.device_model}</TableCell>
                <TableCell>{formatDuration(trace.duration_ms)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TraceList;

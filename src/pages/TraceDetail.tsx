import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import TraceViewer from "@/components/TraceViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { TraceMetadata } from "@/types";
import { traceApi } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";

const TraceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [trace, setTrace] = useState<TraceMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTrace = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const response = await traceApi.getTrace(id);

        if (response.error) {
          throw new Error(response.error);
        }

        if (response.data) {
          setTrace(response.data);
        }
      } catch (error) {
        setError((error as Error).message);
        toast({
          title: "Failed to load trace",
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTrace();
  }, [id, toast]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return "Unknown";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const backAction = (
    <Link to="/traces">
      <Button variant="outline" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Traces
      </Button>
    </Link>
  );

  if (loading) {
    return (
      <AuthGuard>
        <Layout>
          <PageLayout>
            <PageHeader 
              title={<Skeleton className="h-8 w-48" />} 
              actions={<Skeleton className="h-9 w-36 rounded-md" />} 
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-[60vh]" />
          </PageLayout>
        </Layout>
      </AuthGuard>
    );
  }

  if (error || !trace) {
    return (
      <AuthGuard>
        <Layout>
          <div className="text-center py-12 space-y-6">
            <p className="text-destructive">{error || "Trace not found"}</p>
            <Link to="/traces">
              <Button>Back to Traces</Button>
            </Link>
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Layout>
        <PageLayout>
          <PageHeader 
            title={trace.scenario || "Trace Details"} 
            actions={backAction} 
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Uploaded</div>
                <div className="text-lg font-medium">
                  {formatDate(trace.uploaded_at)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Commit</div>
                <div className="text-lg font-medium font-mono">
                  {trace.commit_sha}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {trace.branch}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Scenario</div>
                <div className="text-lg font-medium">{trace.scenario}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {trace.device_model}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-lg font-medium text-primary">
                  {formatDuration(trace.duration_ms)}
                </div>
              </CardContent>
            </Card>
          </div>

          {trace.notes && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Notes</div>
                <div className="whitespace-pre-wrap">{trace.notes}</div>
              </CardContent>
            </Card>
          )}

          <TraceViewer traceUrl={`/api/traces/${trace.id}/data`} />
        </PageLayout>
      </Layout>
    </AuthGuard>
  );
};

export default TraceDetail;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { traceApi } from "@/lib/api";
import { TraceUpload } from "@/types";
import { AlertCircle } from "lucide-react";

const UploadDialog: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Omit<TraceUpload, "blob_path" | "duration_ms">>({
    commit_sha: "",
    branch: "",
    scenario: "",
    device_model: "",
    notes: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Clear any previous errors
      setError(null);
      
      if (selectedFile.type !== "application/json" && !selectedFile.name.endsWith(".json")) {
        toast({
          title: "Invalid file type",
          description: "Please select a JSON file",
          variant: "destructive",
        });
        return;
      }

      if (selectedFile.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 100MB",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    
    // Clear any previous errors
    setError(null);
    
    if (droppedFile) {
      if (droppedFile.type !== "application/json" && !droppedFile.name.endsWith(".json")) {
        toast({
          title: "Invalid file type",
          description: "Please drop a JSON file",
          variant: "destructive",
        });
        return;
      }

      if (droppedFile.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 100MB",
          variant: "destructive",
        });
        return;
      }

      setFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a trace file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      
      const response = await traceApi.uploadTrace(file, metadata);
      
      if (response.error) {
        setError(response.error);
        toast({
          title: "Upload failed",
          description: response.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Trace saved",
        description: "Your trace file has been uploaded successfully",
      });

      // Navigate to the traces list
      navigate("/traces");
    } catch (error) {
      const errorMessage = (error as Error).message || "Something went wrong";
      setError(errorMessage);
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Upload Performance Trace</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              file ? "border-primary" : "border-border"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {file ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFile(null)}
                  size="sm"
                >
                  Change file
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <svg
                    className="w-12 h-12 text-muted-foreground"
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
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop your trace file, or{" "}
                    <label className="text-primary cursor-pointer hover:underline">
                      browse
                      <Input
                        type="file"
                        className="sr-only"
                        accept=".json,application/json"
                        onChange={handleFileChange}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JSON files only, up to 100MB
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commit_sha">Commit SHA</Label>
                <Input
                  id="commit_sha"
                  name="commit_sha"
                  value={metadata.commit_sha}
                  onChange={handleInputChange}
                  placeholder="e.g. a1b2c3d4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  name="branch"
                  value={metadata.branch}
                  onChange={handleInputChange}
                  placeholder="e.g. main"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scenario">Scenario</Label>
                <Input
                  id="scenario"
                  name="scenario"
                  value={metadata.scenario}
                  onChange={handleInputChange}
                  placeholder="e.g. cold start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device_model">Device Model</Label>
                <Input
                  id="device_model"
                  name="device_model"
                  value={metadata.device_model}
                  onChange={handleInputChange}
                  placeholder="e.g. iPhone 15 Pro"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={metadata.notes}
                onChange={handleInputChange}
                placeholder="Additional information about this trace..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? "Uploading..." : "Upload Trace"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default UploadDialog;

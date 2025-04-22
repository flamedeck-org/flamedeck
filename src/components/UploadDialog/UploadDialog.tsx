import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { traceApi } from "@/lib/api";
import { TraceUpload } from "@/types";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTraceProcessor } from "./hooks/useTraceProcessor";
import { cn } from "@/lib/utils";

// Define the shape of our form data
type FormFields = Omit<
    TraceUpload,
    'blob_path' | 'duration_ms' | 'profile_type' |
    'id' | 'created_at' | 'user_id' | 'file_name'
>;

export function UploadDialog() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Initialize react-hook-form
  const {
    register,
    handleSubmit: handleRHFSubmit,
    formState: { errors, dirtyFields },
  } = useForm<FormFields>({
    defaultValues: {
      commit_sha: "",
      branch: "",
      scenario: "",
      device_model: "",
      notes: "",
    },
    mode: "onChange",
  });

  // Use the custom hook for processing
  const {
    isProcessing,
    processingError,
    processedFile,
    processedDurationMs,
    profileType
  } = useTraceProcessor({ file });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setUploadError(null);

    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 100MB",
          variant: "destructive",
        });
         setFile(null);
        return;
      }
      setFile(selectedFile);
    } else {
       setFile(null);
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    setUploadError(null);

    if (droppedFile) {
      if (droppedFile.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 100MB",
          variant: "destructive",
        });
        setFile(null);
        return;
      }
       setFile(droppedFile);
    } else {
       setFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // This function now receives the validated form data
  const onSubmit: SubmitHandler<FormFields> = async (formData) => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a trace file",
        variant: "destructive",
      });
      return;
    }

     if (isProcessing) {
      toast({
        title: "Processing in progress",
        description: "Please wait for the trace file to finish processing before uploading.",
        variant: "default",
      });
      return;
    }

    if (processingError) {
         toast({
           title: "Cannot Upload",
           description: `The selected file failed processing: ${processingError}. Please select a different file.`,
           variant: "destructive",
         });
         return;
    }

    if (!processedFile || processedDurationMs === null || !profileType) {
         toast({
           title: "Processing Not Complete",
           description: "File processing is not yet complete or failed silently. Please try re-selecting the file.",
           variant: "destructive",
         });
         console.error("Submit called but processedFile, processedDurationMs, or profileType is missing", { processedFile, processedDurationMs, profileType });
         return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const finalMetadata: Omit<TraceUpload, 'blob_path'> = {
        ...formData,
        duration_ms: processedDurationMs,
        profile_type: profileType,
      };

      const fileToUpload = new File([processedFile], `${file.name}.speedscope.json`, { type: processedFile.type });
      const response = await traceApi.uploadTrace(fileToUpload, finalMetadata);

      if (response.error) {
        setUploadError(response.error);
        toast({
          title: "Upload failed",
          description: response.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Trace saved",
          description: "Your trace file has been processed and uploaded successfully",
        });
        if (response.data?.id) {
          navigate(`/traces/${response.data.id}`);
        } else {
          console.error("Upload succeeded but trace ID was missing in response.");
          navigate("/traces");
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during upload.";
      setUploadError(errorMessage);
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isSubmitDisabled = isUploading || isProcessing || !file || !!processingError || !processedFile || !profileType || !!errors.scenario;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Upload Performance Trace</CardTitle>
      </CardHeader>
      <CardContent>
        {uploadError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Upload Error</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}
         {processingError && !isProcessing && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Processing Error</AlertTitle>
            <AlertDescription>
              {processingError} Please try a different file or check the console for details.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleRHFSubmit(onSubmit)} className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              file ? "border-primary/50" : "border-border hover:border-primary/30"
            } ${ isProcessing ? "cursor-wait" : "" }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {!file ? (
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
                        onChange={handleFileChange}
                        disabled={isProcessing}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Speedscope compatible files (e.g., .json, .perf, collapsed stacks), up to 100MB
                  </p>
                </div>
              </div>
            ) : isProcessing ? (
                <div className="space-y-2 flex flex-col items-center justify-center h-24">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium mt-2">Processing trace...</p>
                  <p className="text-xs text-muted-foreground">{file.name}</p>
               </div>
            ) : processingError ? (
                <div className="space-y-2 flex flex-col items-center justify-center h-24 text-destructive">
                 <AlertCircle className="h-8 w-8" />
                 <p className="text-sm font-medium mt-2">Processing Failed</p>
                 <p className="text-xs">{file.name}</p>
                 <Button
                    type="button"
                    variant="outline"
                    onClick={clearFile}
                    size="sm"
                    className="mt-2"
                 >
                    Clear file
                 </Button>
               </div>
            ) : processedFile && processedDurationMs !== null ? (
              <div className="space-y-2">
                 <p className="text-sm font-medium">{file.name}</p>
                 <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB | Duration: {(processedDurationMs / 1000).toFixed(2)}s
                 </p>
                 <Button
                   type="button"
                   variant="outline"
                   onClick={clearFile}
                   size="sm"
                 >
                   Change file
                 </Button>
              </div>
             ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">Waiting to process...</p>
                   <Button
                    type="button"
                    variant="outline"
                    onClick={clearFile}
                    size="sm"
                  >
                    Change file
                  </Button>
                </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scenario">Scenario *</Label>
                <Input
                  id="scenario"
                  placeholder="e.g. cold start"
                  {...register("scenario", { required: "Scenario is required" })}
                  className={cn(
                    errors.scenario && dirtyFields.scenario && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {errors.scenario && dirtyFields.scenario && (
                   <p className="text-sm text-destructive mt-1">{errors.scenario.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="device_model">Device Model</Label>
                <Input
                  id="device_model"
                  placeholder="e.g. iPhone 15 Pro"
                  {...register("device_model")}
                />
              </div>
            </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commit_sha">Commit SHA</Label>
                <Input
                  id="commit_sha"
                  placeholder="e.g. a1b2c3d4"
                  {...register("commit_sha")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="e.g. main"
                  {...register("branch")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional information about this trace..."
                rows={3}
                {...register("notes")}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitDisabled}>
              {isUploading ? "Uploading..." : isProcessing ? "Processing..." : "Upload Trace"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
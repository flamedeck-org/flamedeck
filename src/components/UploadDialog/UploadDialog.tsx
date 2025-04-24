import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { traceApi, Folder, ApiError } from "@/lib/api";
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

// Define component props
interface UploadDialogProps {
  initialFolderId?: string | null; 
}

export function UploadDialog({ initialFolderId }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  // --- Fetch Folder Details --- 
  const { 
    data: folderData, 
    isLoading: isLoadingFolder, 
    error: folderError 
  } = useQuery<Folder, ApiError>({
      queryKey: ['folder', initialFolderId], 
      queryFn: async () => {
          if (!initialFolderId) return null; // Should not happen based on enabled flag
          const response = await traceApi.getFolder(initialFolderId);
          if (response.error) throw response.error; // Throw error for React Query
          if (!response.data) throw new Error("Folder data not found after successful fetch.");
          return response.data;
      },
      enabled: !!initialFolderId, // Only run query if initialFolderId is truthy
      staleTime: 5 * 60 * 1000, // Cache folder name for 5 minutes
      gcTime: 10 * 60 * 1000, // Garbage collect after 10 minutes
      retry: 1, // Retry once on error
  });

  // Determine display text based on query state (memoized)
  const targetFolderInfo = useMemo(() => {
    if (!initialFolderId) return "My Traces (Root)";
    if (isLoadingFolder) return "Loading folder name...";
    if (folderError) return `Error loading folder: ${folderError.message}`;
    if (folderData) return folderData.name;
    return "Unknown Folder";
  }, [initialFolderId, isLoadingFolder, folderError, folderData]);

  // Determine if target folder has an error (memoized)
  const isTargetFolderError = useMemo(() => 
    !initialFolderId ? false : isLoadingFolder || !!folderError || !folderData,
    [initialFolderId, isLoadingFolder, folderError, folderData]
  );

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

  // --- File Handling (Callbacks) --- 
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [toast]); // Added toast dependency

  const clearFile = useCallback(() => {
    setFile(null);
    // Also clear potential processing errors related to the old file
    setUploadError(null); 
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
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
  }, [toast]); // Added toast dependency

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  // --- Form Submission (Callback) --- 
  const onSubmit: SubmitHandler<FormFields> = useCallback(async (formData) => {
    // Add file null check inside callback
    if (!file) {
      toast({ title: "No file selected", /*...*/ variant: "destructive" });
      return;
    }
    // Add processing checks inside callback
    if (isProcessing) {
      toast({ title: "Processing in progress", /*...*/ });
      return;
    }
    if (processingError) {
      toast({ title: "Cannot Upload", description: `The selected file failed processing: ${processingError}. Please select a different file.`, variant: "destructive" });
      return;
    }
    if (!processedFile || processedDurationMs === null || !profileType) {
       toast({ title: "Processing Not Complete", /*...*/ variant: "destructive" });
       console.error("Submit called but processedFile, processedDurationMs, or profileType is missing", { processedFile, processedDurationMs, profileType });
       return;
    }
    // Add check for folder loading error inside callback
    if (isTargetFolderError && initialFolderId) {
        toast({ title: "Cannot Upload", description: "Target folder details could not be loaded. Please go back and try again.", variant: "destructive" });
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
      const response = await traceApi.uploadTrace(fileToUpload, finalMetadata, initialFolderId);

      if (response.error) {
        setUploadError(response.error.message);
        toast({ title: "Upload failed", description: response.error.message, variant: "destructive" });
      } else {
        toast({ title: "Trace saved", description: "Your trace file has been processed and uploaded successfully" });
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
      toast({ title: "Upload failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [ // Add dependencies for onSubmit
      file, 
      isProcessing, 
      processingError, 
      processedFile, 
      processedDurationMs, 
      profileType, 
      isTargetFolderError, 
      initialFolderId, 
      toast, 
      navigate
  ]);

  // --- Submit Disabled State (Memoized) --- 
  const isSubmitDisabled = useMemo(() => 
    isUploading || isProcessing || !file || !!processingError || !processedFile || !profileType || !!errors.scenario || isTargetFolderError,
    [isUploading, isProcessing, file, processingError, processedFile, profileType, errors.scenario, isTargetFolderError]
  );

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

        {/* Display target folder info (dynamic now) */}
        <div className={cn(
            "text-sm mb-4 p-3 rounded-md",
            isTargetFolderError && initialFolderId ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
        )}>
            Uploading to: <span className="font-medium text-foreground">{targetFolderInfo}</span>
        </div>

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
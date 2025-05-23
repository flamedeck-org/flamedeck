import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Folder } from '@/lib/api';
import { traceApi } from '@/lib/api';
import type { TraceUpload, ApiError } from '@/types';
import { AlertCircle, Loader2, Edit } from 'lucide-react';
import { useTraceProcessor } from './hooks/useTraceProcessor';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { FolderSelectDialog } from '@/components/FolderSelectDialog';
import { getFolderViewQueryKey } from '@/components/TraceList/hooks/useTraces';
import { getSubscriptionUsageQueryKey } from '@/hooks/useSubscriptionUsage';

// Define the shape of our form data
type FormFields = Omit<
  TraceUpload,
  'blob_path' | 'duration_ms' | 'profile_type' | 'id' | 'created_at' | 'user_id' | 'file_name'
>;

// Define component props
interface UploadDialogProps {
  initialFolderId?: string | null;
  initialFile?: File | null;
  onClose?: () => void;
}

export function UploadDialog({ initialFolderId, initialFile, onClose }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { user } = useAuth();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId || null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const navigate = useNavigate();

  // --- Fetch Folder Details ---
  const {
    data: selectedFolderData,
    isLoading: isLoadingSelectedFolder,
    error: selectedFolderError,
  } = useQuery<Folder | null, ApiError>({
    queryKey: ['folder', selectedFolderId],
    queryFn: async () => {
      if (!selectedFolderId) return null;
      const response = await traceApi.getFolder(selectedFolderId);
      if (response.error) throw response.error;
      return response.data ?? null;
    },
    enabled: !!selectedFolderId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Determine display text based on query state (memoized)
  const targetFolderInfo = useMemo(() => {
    if (selectedFolderId === null) return 'My Traces (Root)';
    if (isLoadingSelectedFolder) return 'Loading folder name...';
    if (selectedFolderError) return `Error: ${selectedFolderError.message}`;
    if (selectedFolderData) return selectedFolderData.name;
    return 'Unknown Folder';
  }, [selectedFolderId, isLoadingSelectedFolder, selectedFolderError, selectedFolderData]);

  // Determine if target folder has an error (memoized)
  const isTargetFolderError = useMemo(
    () => (selectedFolderId === null ? false : isLoadingSelectedFolder || !!selectedFolderError),
    [selectedFolderId, isLoadingSelectedFolder, selectedFolderError]
  );

  // Initialize react-hook-form
  const {
    register,
    handleSubmit: handleRHFSubmit,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<FormFields>({
    defaultValues: {
      commit_sha: '',
      branch: '',
      scenario: '',
      notes: '',
    },
    mode: 'onChange',
  });

  // Use the custom hook for processing
  const { isProcessing, processingError, processedFile, processedDurationMs, profileType } =
    useTraceProcessor({ file });

  // --- Initialize file state and scenario from initialFile prop ---
  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      // Trigger processing immediately if initial file is provided
      // (useTraceProcessor hook depends on the 'file' state)
      const fileNameWithoutExt = initialFile.name.split('.').slice(0, -1).join('.');
      if (!dirtyFields.scenario) {
        // Only set if not already dirty
        setValue('scenario', fileNameWithoutExt, { shouldDirty: true });
      }
    } else {
      // If initialFile is removed or not provided, clear the file state
      // setFile(null); // This is handled by the useState initializer
      // setValue("scenario", ""); // Keep potentially user-entered scenario
    }
  }, [initialFile, setValue, dirtyFields.scenario]);

  // --- File Handling (Callbacks) ---
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      setUploadError(null);

      if (selectedFile) {
        if (selectedFile.size > 100 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: 'Maximum file size is 100MB',
            variant: 'destructive',
          });
          setFile(null);
          setValue('scenario', '');
          return;
        }
        setFile(selectedFile);
        const fileNameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
        setValue('scenario', fileNameWithoutExt, { shouldDirty: true });
      } else {
        setFile(null);
        setValue('scenario', '');
      }
    },
    [toast, setValue]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    // Also clear potential processing errors related to the old file
    setUploadError(null);
    setValue('scenario', '');
    // If we clear the file, and there was an initial file, we might want to inform the parent
    // This depends on whether the UploadDialog is intended to be fully standalone
    // or if the parent needs to know the initial file was discarded.
    // For now, we'll assume the dialog manages its state internally after initialization.
  }, [setValue]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      setUploadError(null);

      if (droppedFile) {
        if (droppedFile.size > 100 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: 'Maximum file size is 100MB',
            variant: 'destructive',
          });
          setFile(null);
          setValue('scenario', '');
          return;
        }
        setFile(droppedFile);
        const fileNameWithoutExt = droppedFile.name.split('.').slice(0, -1).join('.');
        setValue('scenario', fileNameWithoutExt, { shouldDirty: true });
      } else {
        setFile(null);
        setValue('scenario', '');
      }
    },
    [toast, setValue]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  // --- Folder Selection Handling ---
  const handleSelectFolder = useCallback(
    (folderId: string | null) => {
      setSelectedFolderId(folderId);
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
      }
      setIsMoveDialogOpen(false);
    },
    [queryClient]
  );

  // --- Form Submission (Callback) ---
  const onSubmit: SubmitHandler<FormFields> = useCallback(
    async (formData) => {
      // Add file null check inside callback
      if (!file) {
        toast({ title: 'No file selected', /*...*/ variant: 'destructive' });
        return;
      }
      // Add processing checks inside callback
      if (isProcessing) {
        toast({ title: 'Processing in progress' /*...*/ });
        return;
      }
      if (processingError) {
        toast({
          title: 'Cannot Upload',
          description: `The selected file failed processing: ${processingError}. Please select a different file.`,
          variant: 'destructive',
        });
        return;
      }
      if (!processedFile || processedDurationMs === null || !profileType) {
        toast({ title: 'Processing Not Complete', /*...*/ variant: 'destructive' });
        console.error(
          'Submit called but processedFile, processedDurationMs, or profileType is missing',
          { processedFile, processedDurationMs, profileType }
        );
        return;
      }
      // Add check for folder loading error inside callback
      if (isTargetFolderError && selectedFolderId) {
        toast({
          title: 'Cannot Upload',
          description: 'Target folder details could not be loaded. Please go back and try again.',
          variant: 'destructive',
        });
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

        const fileToUpload = new File([processedFile], `${file.name}.speedscope.json`, {
          type: processedFile.type,
        });
        const response = await traceApi.uploadTrace(
          fileToUpload,
          finalMetadata,
          user.id,
          selectedFolderId
        );

        if (response.error) {
          setUploadError(response.error.message);
          toast({
            title: 'Upload failed',
            description: response.error.message,
            variant: 'destructive',
          });
        } else {
          // const newTraceId = response.data?.id;
          toast({
            title: 'Trace saved',
            description: 'Your trace file has been processed and uploaded successfully',
            // action: newTraceId ? (
            //   <ToastAction
            //     altText="View Trace"
            //     onClick={() => navigate(`/traces/${newTraceId}/view`)}
            //   >
            //     View Trace
            //   </ToastAction>
            // ) : undefined,
          });

          queryClient.invalidateQueries({ queryKey: getFolderViewQueryKey(selectedFolderId, '') });
          if (user?.id) {
            queryClient.invalidateQueries({ queryKey: getSubscriptionUsageQueryKey(user.id) });
          }

          if (onClose) onClose();

          // Navigate to folder (keep existing navigation)
          if (selectedFolderId) {
            navigate(`/traces/folder/${selectedFolderId}`);
          } else {
            navigate('/traces');
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred during upload.';
        setUploadError(errorMessage);
        toast({ title: 'Upload failed', description: errorMessage, variant: 'destructive' });
      } finally {
        setIsUploading(false);
      }
    },
    [
      file,
      isProcessing,
      processingError,
      processedFile,
      processedDurationMs,
      profileType,
      isTargetFolderError,
      selectedFolderId,
      toast,
      navigate,
      user,
      onClose,
      queryClient,
    ]
  );

  // --- Submit Disabled State (Memoized) ---
  const isSubmitDisabled = useMemo(
    () =>
      isUploading ||
      isProcessing ||
      !file ||
      !!processingError ||
      !processedFile ||
      !profileType ||
      !!errors.scenario ||
      isTargetFolderError,
    [
      isUploading,
      isProcessing,
      file,
      processingError,
      processedFile,
      profileType,
      errors.scenario,
      isTargetFolderError,
    ]
  );

  return (
    <>
      {uploadError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="pb-2">Upload Error</AlertTitle>
          <AlertDescription className="pb-2">{uploadError}</AlertDescription>
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

      {/* Container for Upload Target Info + Change Button */}
      <div className="flex items-center justify-between mb-4">
        <div
          className={cn(
            'text-sm p-3 rounded-md flex-grow mr-2',
            isTargetFolderError
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          )}
        >
          Uploading to: <span className="font-medium text-foreground">{targetFolderInfo}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMoveDialogOpen(true)}
          disabled={isUploading || isProcessing}
        >
          <Edit className="h-4 w-4 mr-2" /> Change
        </Button>
      </div>

      <form onSubmit={handleRHFSubmit(onSubmit)} className="space-y-6">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${file ? 'border-primary/50' : 'border-border hover:border-primary/30'
            } ${isProcessing ? 'cursor-wait' : ''}`}
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
                  Drag and drop your trace file, or{' '}
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
                {(file.size / 1024 / 1024).toFixed(2)} MB | Duration:{' '}
                {(processedDurationMs / 1000).toFixed(2)}s
              </p>
              <Button type="button" variant="outline" onClick={clearFile} size="sm">
                Change file
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">Waiting to process...</p>
              <Button type="button" variant="outline" onClick={clearFile} size="sm">
                Change file
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scenario">Scenario *</Label>
          <Input
            id="scenario"
            placeholder="e.g. cold start"
            {...register('scenario', { required: 'Scenario is required' })}
            className={cn(
              errors.scenario &&
              dirtyFields.scenario &&
              'border-destructive focus-visible:ring-destructive'
            )}
          />
          {errors.scenario && dirtyFields.scenario && (
            <p className="text-sm text-destructive mt-1">{errors.scenario.message}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commit_sha">Commit SHA</Label>
              <Input id="commit_sha" placeholder="e.g. a1b2c3d4" {...register('commit_sha')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input id="branch" placeholder="e.g. main" {...register('branch')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional information about this trace..."
              rows={3}
              {...register('notes')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitDisabled}>
            {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Upload Trace'}
          </Button>
        </div>
      </form>

      {/* Folder Select Dialog (Controlled by state) */}
      <FolderSelectDialog
        isOpen={isMoveDialogOpen}
        setIsOpen={setIsMoveDialogOpen}
        onFolderSelected={handleSelectFolder}
        initialFolderId={selectedFolderId}
        title="Select Upload Folder"
        description="Choose the folder where you want to upload the trace."
      />
    </>
  );
}

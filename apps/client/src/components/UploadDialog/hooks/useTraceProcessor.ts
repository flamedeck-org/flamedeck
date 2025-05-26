import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { type ProfileType } from '@flamedeck/speedscope-import';
import { processAndPrepareTraceUpload } from '../utils';

interface UseTraceProcessorProps {
  file: File | null;
}

interface UseTraceProcessorReturn {
  isProcessing: boolean;
  processingError: string | null;
  processedFile: File | null;
  processedDurationMs: number | null;
  profileType: ProfileType | null;
}

export function useTraceProcessor({ file }: UseTraceProcessorProps): UseTraceProcessorReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  const [processedDurationMs, setProcessedDurationMs] = useState<number | null>(null);
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const currentFileRef = useRef<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (file && file !== currentFileRef.current) {
      const processFile = async () => {
        setIsProcessing(true);
        setProcessingError(null);
        setProcessedFile(null);
        setProcessedDurationMs(null);
        setProfileType(null);
        currentFileRef.current = file; // Mark this file as the one being processed

        try {
          const {
            processedFile: newProcessedFile,
            durationMs,
            profileType: detectedType,
          } = await processAndPrepareTraceUpload(file);

          if (file === currentFileRef.current) {
            console.log(
              'Background processing complete:',
              file.name,
              'Duration:',
              durationMs,
              'Type:',
              detectedType
            );
            setProcessedFile(newProcessedFile);
            setProcessedDurationMs(durationMs);
            setProfileType(detectedType);
            setProcessingError(null);
          }
        } catch (error) {
          if (file === currentFileRef.current) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : 'An unknown error occurred during processing.';
            console.error('Background processing failed:', errorMessage);
            setProcessingError(errorMessage);
            setProcessedFile(null);
            setProcessedDurationMs(null);
            setProfileType(null);
            toast({
              title: 'Trace Processing Failed',
              description: errorMessage,
              variant: 'destructive',
            });
          }
        } finally {
          if (file === currentFileRef.current) {
            setIsProcessing(false);
          }
        }
      };
      processFile();
    } else if (!file) {
      setIsProcessing(false);
      setProcessingError(null);
      setProcessedFile(null);
      setProcessedDurationMs(null);
      setProfileType(null);
      currentFileRef.current = null;
    }
  }, [file, toast]);

  return { isProcessing, processingError, processedFile, processedDurationMs, profileType };
}

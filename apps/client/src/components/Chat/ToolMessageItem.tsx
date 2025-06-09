import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, Cog, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ChatMessage } from './ChatWindow'; // Assuming ChatMessage is exported from ChatWindow.tsx
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface ToolMessageItemProps {
  message: ChatMessage;
}

const screenshotToolNames = [
  'generate_flamegraph_screenshot',
  'generate_sandwich_flamegraph_screenshot',
];

export const ToolMessageItem: React.FC<ToolMessageItemProps> = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(screenshotToolNames.includes(message.toolName));
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isFetchingImage, setIsFetchingImage] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleImageClick = useCallback(() => {
    setIsLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsLightboxOpen(false);
  }, []);

  useEffect(() => {
    let objectUrl: string | undefined;
    // Reset image state if message changes or imageUrl is cleared
    if (!message.imageUrl || message.resultType !== 'image') {
      if (imageDataUrl) URL.revokeObjectURL(imageDataUrl); // Clean up old object URL
      setImageDataUrl(null);
      setImageError(null);
      setIsFetchingImage(false);
      return;
    }

    // Fetch image only if it's an image type, has a URL, and hasn't been fetched/errored for this specific URL
    if (
      message.resultType === 'image' &&
      message.imageUrl &&
      !imageDataUrl &&
      !imageError &&
      !isFetchingImage
    ) {
      setIsFetchingImage(true);
      const fetchImage = async () => {
        try {
          // Extract the path from the public URL.
          // Assumes publicURL structure like: .../storage/v1/object/public/bucket_name/file_path.png
          // We need just the file_path.png part for the .download() method.
          const supabaseStoragePrefix = `/storage/v1/object/public/ai-snapshots/`;
          let imagePath = message.imageUrl!;
          if (imagePath.includes(supabaseStoragePrefix)) {
            imagePath = imagePath.substring(
              imagePath.indexOf(supabaseStoragePrefix) + supabaseStoragePrefix.length
            );
          }

          console.log(`[ToolMessageItem] Downloading image from path: ${imagePath}`);
          const { data, error } = await supabase.storage.from('ai-snapshots').download(imagePath);

          if (error) {
            throw error;
          }
          if (data) {
            objectUrl = URL.createObjectURL(data);
            setImageDataUrl(objectUrl);
            setImageError(null);
          } else {
            throw new Error('No data received for image.');
          }
        } catch (err: any) {
          console.error('[ToolMessageItem] Error downloading tool image:', err);
          setImageError(err.message || 'Failed to load image');
        }
        setIsFetchingImage(false);
      };

      fetchImage();
    }

    return () => {
      // Cleanup object URL when component unmounts or message.imageUrl changes triggering re-fetch
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
    // Re-run effect if the message ID, imageUrl, or resultType changes, to handle new/updated image tool messages.
    // isFetchingImage helps prevent re-fetch loops if other dependencies change rapidly.
  }, [message.id, message.imageUrl, message.resultType, imageDataUrl, imageError, isFetchingImage]);

  // Default styling for tool messages (neutral)
  let borderColor = 'border-border/20';
  let textColor = 'text-foreground';
  let bgColor = 'bg-muted/40 backdrop-blur-sm';
  let StatusIcon = null;

  // Determine icon and specific error styling
  if (message.toolStatus === 'running') {
    StatusIcon = <Cog size={18} className="animate-spin mr-2 text-blue-500" />;
    bgColor = 'bg-blue-50/80 dark:bg-blue-950/30 backdrop-blur-sm';
    borderColor = 'border-blue-300/40 dark:border-blue-600/40';
  } else if (message.toolStatus === 'success' || message.toolStatus === 'success_with_warning') {
    StatusIcon = <CheckCircle2 size={18} className="mr-2 text-green-500" />;
    bgColor = 'bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-950/40 dark:to-gray-950/40 backdrop-blur-sm';
    borderColor = 'border-green-300/40 dark:border-green-600/40';
  } else if (message.toolStatus === 'error') {
    StatusIcon = <AlertCircle size={18} className="mr-2 text-red-500" />;
    bgColor = 'bg-gradient-to-br from-red-50/80 to-red-50/80 dark:from-red-950/30 dark:to-red-950/30 backdrop-blur-sm';
    borderColor = 'border-red-300/40 dark:border-red-600/40';
    textColor = 'text-red-700 dark:text-red-300';
  }

  const getToolName = useCallback((toolName: string) => {
    if (toolName === 'generate_flamegraph_screenshot') {
      return 'Flamegraph Snapshot';
    } else if (toolName === 'generate_sandwich_flamegraph_screenshot') {
      return 'Sandwich Flamegraph Snapshot';
    } else if (toolName === 'get_top_functions') {
      return 'Top Functions';
    }
    return toolName?.replace(/_/g, ' ') || 'Tool Execution';
  }, []);

  // Determine if text content should be displayed
  const shouldDisplayText = !(
    screenshotToolNames.includes(message.toolName) &&
    (message.toolStatus === 'success' || message.toolStatus === 'success_with_warning')
  );

  return (
    <div className={`flex justify-start`}>
      <div
        className={`w-full max-w-[90%] p-0 rounded-xl text-sm border ${borderColor} ${bgColor} ${textColor} overflow-hidden shadow-sm`}
      >
        <button
          onClick={toggleExpand}
          className="w-full flex justify-between items-center px-4 py-2.5 text-left focus:outline-none hover:bg-background/20 transition-all duration-200"
        >
          <span className="font-semibold flex items-center">
            {StatusIcon}
            {getToolName(message.toolName)}
          </span>
          <span className="flex items-center">
            {message.toolStatus !== 'running' && (
              <span className="font-medium text-xs mr-3 px-2 py-1 bg-background/40 rounded-md border border-border/30 text-muted-foreground">
                {isExpanded ? 'Hide Details' : 'Show Details'}
              </span>
            )}
            {message.toolStatus !== 'running' &&
              (isExpanded ? <ChevronUp size={18} className="opacity-70 hover:opacity-100 transition-opacity" /> : <ChevronDown size={18} className="opacity-70 hover:opacity-100 transition-opacity" />)}
          </span>
        </button>

        {/* Collapsible Content - only show details if not running OR if running and expanded (though running usually won't have details yet) */}
        {(isExpanded || message.toolStatus === 'running') && (
          <div className="px-4 pb-4 border-t border-border/20">
            {shouldDisplayText && message.text && (
              <div className="whitespace-pre-wrap break-words mt-3 text-sm leading-relaxed">{message.text}</div>
            )}

            {message.resultType === 'image' && message.toolStatus !== 'running' && (
              <div className="mt-4 flex justify-center">
                {isFetchingImage && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading image...
                  </div>
                )}
                {imageError && (
                  <p className="text-sm text-red-500 bg-red-50/50 dark:bg-red-950/20 px-3 py-2 rounded-lg border border-red-200/50 dark:border-red-800/50">
                    Error loading image: {imageError}
                  </p>
                )}
                {imageDataUrl && (
                  <>
                    <div className="rounded-xl overflow-hidden border-2 border-border/40 shadow-lg">
                      <img
                        src={imageDataUrl}
                        alt={`${message.toolName || 'Tool'} result`}
                        className="max-w-full h-auto max-h-80 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={handleImageClick}
                      />
                    </div>

                    <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
                      <DialogContent className="max-w-none w-screen h-screen p-0 bg-black/95 border-0 [&>button]:hidden">
                        <div className="relative w-full h-full flex items-center justify-center">
                          <button
                            onClick={closeLightbox}
                            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            aria-label="Close lightbox"
                          >
                            <X size={24} />
                          </button>
                          <img
                            src={imageDataUrl}
                            alt={`${message.toolName || 'Tool'} result - Fullscreen`}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

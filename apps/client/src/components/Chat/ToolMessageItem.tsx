import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ChatMessage } from './ChatWindow'; // Assuming ChatMessage is exported from ChatWindow.tsx

interface ToolMessageItemProps {
  message: ChatMessage;
}

export const ToolMessageItem: React.FC<ToolMessageItemProps> = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isFetchingImage, setIsFetchingImage] = useState<boolean>(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
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

  let borderColor = 'border-gray-300 dark:border-gray-600';
  let textColor = 'text-gray-700 dark:text-gray-300';
  let bgColor = 'bg-gray-100 dark:bg-gray-750';
  let StatusIcon = null;

  // Determine icon and colors based on status
  if (message.toolStatus === 'running') {
    StatusIcon = <Loader2 size={18} className="animate-spin mr-2 text-blue-500" />;
    bgColor = 'bg-blue-50 dark:bg-blue-900/30';
    borderColor = 'border-blue-300 dark:border-blue-700/50';
    textColor = 'text-blue-700 dark:text-blue-300';
  } else if (message.toolStatus === 'success' || message.toolStatus === 'success_with_warning') {
    StatusIcon = <CheckCircle size={18} className="mr-2 text-green-500" />;
  } else if (message.toolStatus === 'error') {
    StatusIcon = <XCircle size={18} className="mr-2 text-red-500" />;
    bgColor = 'bg-red-50 dark:bg-red-900/30';
    borderColor = 'border-red-300 dark:border-red-700/50';
    textColor = 'text-red-700 dark:text-red-300';
  }

  // Determine if text content should be displayed
  const shouldDisplayText = !(
    message.toolName === 'generate_flamegraph_screenshot' &&
    (message.toolStatus === 'success' || message.toolStatus === 'success_with_warning')
  );

  return (
    <div className={`flex justify-start`}>
      <div
        className={`w-full max-w-[90%] p-0 rounded-lg text-sm border ${borderColor} ${bgColor} ${textColor} overflow-hidden`}
      >
        <button
          onClick={toggleExpand}
          className="w-full flex justify-between items-center p-3 text-left focus:outline-none hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <span className="font-semibold flex items-center">
            {StatusIcon}
            {message.toolName?.replace(/_/g, ' ') || 'Tool Execution'}
          </span>
          <span className="flex items-center">
            {message.toolStatus !== 'running' && (
              <span className="font-normal text-xs mr-2">
                ({isExpanded ? 'Hide Details' : 'Show Details'})
              </span>
            )}
            {message.toolStatus !== 'running' &&
              (isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
          </span>
        </button>

        {/* Collapsible Content - only show details if not running OR if running and expanded (though running usually won't have details yet) */}
        {(isExpanded || message.toolStatus === 'running') && (
          <div className="p-3 border-t border-[inherit]">
            {shouldDisplayText && message.text && (
              <div className="whitespace-pre-wrap mb-2">{message.text}</div>
            )}

            {message.resultType === 'image' && message.toolStatus !== 'running' && (
              <div className="mt-2 flex justify-center">
                {isFetchingImage && <p className="text-xs italic">Loading image...</p>}
                {imageError && (
                  <p className="text-xs text-red-500">Error loading image: {imageError}</p>
                )}
                {imageDataUrl && (
                  <img
                    src={imageDataUrl}
                    alt={`${message.toolName || 'Tool'} result`}
                    className="rounded max-w-full h-auto max-h-72 object-contain border dark:border-gray-500 shadow-md"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

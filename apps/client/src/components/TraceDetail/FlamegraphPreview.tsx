import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Download, Eye, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TraceMetadata } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

interface FlamegraphPreviewProps {
    trace?: TraceMetadata;
    lightImagePath?: string | null;
    darkImagePath?: string | null;
    className?: string;
}

function FlamegraphPreviewImpl({
    trace,
    lightImagePath,
    darkImagePath,
    className
}: FlamegraphPreviewProps) {
    const { resolvedTheme } = useTheme();
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // Choose image based on resolved theme from next-themes (single source of truth)
    const currentImagePath = resolvedTheme === 'dark' ? darkImagePath : lightImagePath;
    // Fallback to the other mode if current mode isn't available
    const fallbackImagePath = resolvedTheme === 'dark' ? lightImagePath : darkImagePath;
    const displayImagePath = currentImagePath || fallbackImagePath;

    const hasImages = Boolean(lightImagePath || darkImagePath);

    // Generate signed URL when displayImagePath changes
    useEffect(() => {
        const generateSignedUrl = async () => {
            if (!displayImagePath) {
                setImageUrl(null);
                setImageLoading(false);
                return;
            }

            setImageLoading(true);
            setImageError(false);

            const fileName = displayImagePath.replace('flamegraph-images/', '');
            const { data, error } = await supabase.storage
                .from('flamegraph-images')
                .createSignedUrl(fileName, 3600); // 1 hour expiry

            if (error) {
                console.error('Failed to generate signed URL:', error);
                setImageError(true);
                setImageLoading(false);
                return;
            }

            if (data) {
                console.log('Generated signed URL:', { displayImagePath, fileName, signedUrl: data.signedUrl });
                setImageUrl(data.signedUrl);
            }
        };

        generateSignedUrl();
    }, [displayImagePath]);

    if (!hasImages) {
        console.log('Rendering placeholder - no images');
        return (
            <div className={`flex items-center justify-center bg-gradient-to-br from-muted/10 to-muted/20 rounded-lg aspect-[3/2] border-2 border-red-500 ${className || ''}`}>
                <div className="text-center py-8 text-muted-foreground">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-red-500/10 to-yellow-500/10 rounded-xl flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                    <p className="text-lg font-medium mb-2">Flamegraph Preview</p>
                    <p className="text-sm">Preview will appear here once generated</p>
                    <p className="text-xs mt-2 opacity-50">Debug: traceId={trace?.id}</p>
                </div>
            </div>
        );
    }

    const handleDownload = async () => {
        if (!displayImagePath || !trace) return;

        try {
            const fileName = displayImagePath.replace('flamegraph-images/', '');
            const { data, error } = await supabase.storage
                .from('flamegraph-images')
                .download(fileName);

            if (error) {
                console.error('Download failed:', error);
                return;
            }

            if (data) {
                const url = URL.createObjectURL(data);
                const a = document.createElement('a');
                a.href = url;
                a.download = `flamegraph-${trace?.id}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Download error:', error);
        }
    };

    const handleImageLoad = () => {
        console.log('Image loaded successfully');
        setImageLoading(false);
        setImageError(false);
    };

    const handleImageError = () => {
        console.log('Image failed to load');
        setImageLoading(false);
        setImageError(true);
    };

    if (!displayImagePath) {
        return (
            <div className={`flex items-center justify-center bg-gradient-to-br from-muted/10 to-muted/20 rounded-lg aspect-[3/2] ${className}`}>
                <div className="text-center py-8 text-muted-foreground">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-red-500/10 to-yellow-500/10 rounded-xl flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                    <p className="text-lg font-medium mb-2">Flamegraph Preview</p>
                    <p className="text-sm">Preview will appear here once generated</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative group rounded-lg overflow-hidden aspect-[3/2] bg-muted/5 ${className || ''}`}>
            {/* Loading state - shows as skeleton until image is ready */}
            {imageLoading && (
                <Skeleton className="absolute inset-0 rounded-lg bg-background/50 transition-opacity duration-500" />
            )}

            {/* Image - shows immediately when loaded */}
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt="Flamegraph preview"
                    className="w-full h-full object-cover rounded-lg shadow-lg transition-all duration-300 group-hover:blur-sm"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                />
            )}

            {imageError && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-red-500/20 rounded-lg border-2 border-red-500 transition-opacity duration-300">
                    <div className="text-center">
                        <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Failed to load flamegraph image</p>
                        <p className="text-xs mt-1 opacity-75">Check console for details</p>
                    </div>
                </div>
            )}

            {/* Hover overlay with controls */}
            {!imageLoading && trace && !imageError && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3 rounded-lg">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownload}
                        className="border bg-background/90 text-foreground"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Download image
                    </Button>
                    <Button variant="secondary" size="sm" asChild className="bg-background/90 hover:bg-background text-foreground">
                        <Link
                            to={`/traces/${trace?.id}/view?blob=${encodeURIComponent(trace?.blob_path || '')}`}
                            state={{ blobPath: trace?.blob_path }}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0 transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                            <Eye className="mr-2 h-4 w-4" /> Explore Trace
                        </Link>

                    </Button>
                </div>
            )}
        </div>
    );
}

export const FlamegraphPreview = memo(FlamegraphPreviewImpl); 
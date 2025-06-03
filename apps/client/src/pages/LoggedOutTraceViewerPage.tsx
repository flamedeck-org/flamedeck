import { useState, useCallback, useRef, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UploadCloud, ArrowLeft, Zap, Database, Users, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';

interface TraceUploadState {
    isUploading: boolean;
    isDragging: boolean;
    progress: number;
}

function LoggedOutTraceViewerPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    const [uploadState, setUploadState] = useState<TraceUploadState>({
        isUploading: false,
        isDragging: false,
        progress: 0,
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check if there's initial trace data from homepage drag and drop
    const initialTraceData = location.state?.traceData;
    const initialFileName = location.state?.fileName;

    const processFile = useCallback(async (file: File) => {
        if (file.size > 100 * 1024 * 1024) {
            toast({
                title: 'File too large',
                description: 'Maximum file size is 100MB.',
                variant: 'destructive',
            });
            return;
        }

        setUploadState(prev => ({ ...prev, isUploading: true, progress: 0 }));

        try {
            // Simulate progress for better UX
            const progressInterval = setInterval(() => {
                setUploadState(prev => ({
                    ...prev,
                    progress: Math.min(prev.progress + 20, 90)
                }));
            }, 100);

            // Read the file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            clearInterval(progressInterval);
            setUploadState(prev => ({ ...prev, progress: 100 }));

            // Navigate to trace viewer with the file data
            navigate(`/viewer/trace-viewer`, {
                state: {
                    traceData: arrayBuffer,
                    fileName: file.name,
                    blobPath: null, // No blob path for local files
                },
                replace: true,
            });

        } catch (error) {
            console.error('Error processing trace file:', error);
            toast({
                title: 'Upload failed',
                description: error instanceof Error ? error.message : 'Failed to process the trace file.',
                variant: 'destructive',
            });
        } finally {
            setUploadState(prev => ({ ...prev, isUploading: false, progress: 0 }));
        }
    }, [navigate, toast]);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setUploadState(prev => ({ ...prev, isDragging: false }));

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }, [processFile]);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setUploadState(prev => ({ ...prev, isDragging: true }));
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set isDragging to false if we're leaving the main container
        if (e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
        }
        setUploadState(prev => ({ ...prev, isDragging: false }));
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }, [processFile]);

    const handleBrowseClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // If we have initial trace data, navigate immediately to viewer
    if (initialTraceData && initialFileName) {
        navigate(`/try/trace-viewer`, {
            state: {
                traceData: initialTraceData,
                fileName: initialFileName,
                blobPath: null,
            },
            replace: true,
        });
        return null;
    }

    return (
        <Layout noPadding>
            <div
                className={`h-full bg-background relative transition-all duration-300 overflow-hidden ${uploadState.isDragging ? 'bg-primary/5' : ''
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                style={{ height: 'calc(100vh - var(--navbar-height))' }}
            >
                {/* Drag Overlay */}
                {uploadState.isDragging && (
                    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                        <div className="text-center p-12 bg-card/90 backdrop-blur-xl rounded-3xl border-2 border-dashed border-primary shadow-2xl max-w-md mx-4">
                            <div className="p-6 bg-gradient-to-br from-red-500/10 to-yellow-500/10 rounded-2xl border border-red-500/20 w-fit mx-auto mb-6">
                                <UploadCloud className="w-16 h-16 text-primary animate-pulse" />
                            </div>
                            <h3 className="text-2xl font-bold mb-3">Drop to Upload!</h3>
                            <p className="text-muted-foreground">
                                Release your trace file to start analyzing
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="w-full h-full p-6">
                    {uploadState.isUploading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center space-y-6">
                                <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                <div>
                                    <p className="text-xl font-semibold mb-3">Processing your trace...</p>
                                    <div className="w-full max-w-sm mx-auto bg-muted rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-red-500 to-yellow-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadState.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="w-full h-full border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center bg-secondary cursor-pointer hover:border-primary/50 transition-colors duration-300"
                            onClick={handleBrowseClick}
                        >
                            <img
                                src="/user-input-required.png"
                                alt="Drag and drop your trace file"
                                className="w-64 h-64 object-contain mb-8"
                            />
                            <h1 className="text-4xl font-bold mb-6">Drag & Drop Your Trace</h1>
                            <p className="text-xl text-muted-foreground text-center max-w-lg mb-8">
                                Drop your performance trace file anywhere on this page to get started
                            </p>
                            <Button
                                size="lg"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleBrowseClick();
                                }}
                                className="text-lg px-8 py-4 bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white shadow-xl transition-all duration-300 hover:scale-105"
                            >
                                <UploadCloud className="w-5 h-5 mr-3" />
                                Choose File to Upload
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="sr-only"
                                onChange={handleFileSelect}
                                disabled={uploadState.isUploading}
                                accept=".json,.perf,.speedscope.json,.stackprof.json,.heapprofile,.cpuprofile,.chrome.json,.collapsedstack.txt,.folded,.v8log.json,.linux-perf.txt,.instruments.txt"
                            />
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default memo(LoggedOutTraceViewerPage); 
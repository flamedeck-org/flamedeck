import { useState, useCallback, useRef, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UploadCloud, ArrowLeft, Zap, Database, Users, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTraceUploadModal } from '@/hooks/useTraceUploadModal';

interface TraceUploadState {
    isUploading: boolean;
    isDragging: boolean;
    progress: number;
}

function Home() {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const { openModal: openUploadModal } = useTraceUploadModal();

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

        // Use the TraceUploadModal for authenticated users
        openUploadModal(file, null); // null for no specific folder
    }, [toast, openUploadModal]);

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
        navigate(`/viewer/trace-viewer`, {
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
                    <div
                        className="w-full h-full border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center bg-secondary cursor-pointer hover:border-primary/50 transition-colors duration-300"
                        onClick={handleBrowseClick}
                    >
                        <img
                            src="/user-input-required.png"
                            alt="Drag and drop your trace file"
                            className="w-64 h-64 object-contain mb-8"
                            style={{
                                animation: 'pulse-custom 4s ease-in-out infinite',
                            }}
                        />
                        <style>{`
                            @keyframes pulse-custom {
                                0%, 100% {
                                    opacity: 0.4;
                                }
                                50% {
                                    opacity: 0.6;
                                }
                            }
                        `}</style>
                        <h1 className="text-4xl font-bold mb-6">Drag & Drop Your Trace</h1>
                        <p className="text-xl text-muted-foreground text-center mb-8">
                            Drop your performance trace file anywhere on this page to get started
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
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
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/traces');
                                }}
                                className="text-lg px-8 py-4 border-2 shadow-lg transition-all duration-300 hover:scale-105"
                            >
                                View Traces
                            </Button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="sr-only"
                            onChange={handleFileSelect}
                            disabled={uploadState.isUploading}
                            accept=".json,.perf,.speedscope.json,.stackprof.json,.heapprofile,.cpuprofile,.chrome.json,.collapsedstack.txt,.folded,.v8log.json,.linux-perf.txt,.instruments.txt"
                        />
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default memo(Home); 
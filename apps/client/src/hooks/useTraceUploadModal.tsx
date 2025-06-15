import type { ReactNode } from 'react';
import { useState, createContext, useContext, useCallback, useMemo } from 'react';

interface TraceUploadModalContextType {
  isOpen: boolean;
  droppedFile: File | null;
  targetFolderId: string | null;
  openModal: (file: File | null, folderId: string | null) => void;
  closeModal: () => void;
}

const TraceUploadModalContext = createContext<TraceUploadModalContextType | undefined>(undefined);

interface TraceUploadModalProviderProps {
  children: ReactNode;
}

export function TraceUploadModalProvider({ children }: TraceUploadModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  const openModal = useCallback((file: File | null, folderId: string | null) => {
    setDroppedFile(file);
    setTargetFolderId(folderId);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setDroppedFile(null);
    setTargetFolderId(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      droppedFile,
      targetFolderId,
      openModal,
      closeModal,
    }),
    [isOpen, droppedFile, targetFolderId, openModal, closeModal]
  );

  return (
    <TraceUploadModalContext.Provider value={value}>{children}</TraceUploadModalContext.Provider>
  );
}

export function useTraceUploadModal(): TraceUploadModalContextType {
  const context = useContext(TraceUploadModalContext);
  if (context === undefined) {
    throw new Error('useTraceUploadModal must be used within a TraceUploadModalProvider');
  }
  return context;
}

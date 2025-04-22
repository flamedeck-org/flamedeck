import { useState, createContext, useContext, useCallback, ReactNode, useMemo } from 'react';

interface SharingModalContextType {
  isOpen: boolean;
  traceId: string | null;
  openModal: (traceId: string) => void;
  closeModal: () => void;
}

const SharingModalContext = createContext<SharingModalContextType | undefined>(undefined);

interface SharingModalProviderProps {
  children: ReactNode;
}

export function SharingModalProvider({ children }: SharingModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [traceId, setTraceId] = useState<string | null>(null);

  const openModal = useCallback((id: string) => {
    setTraceId(id);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setTraceId(null); // Clear traceId when closing
  }, []);

  const value = useMemo(() => ({
    isOpen,
    traceId,
    openModal,
    closeModal,
  }), [isOpen, traceId, openModal, closeModal]);

  return (
    <SharingModalContext.Provider value={value}>
      {children}
    </SharingModalContext.Provider>
  );
}

export function useSharingModal(): SharingModalContextType {
  const context = useContext(SharingModalContext);
  if (context === undefined) {
    throw new Error('useSharingModal must be used within a SharingModalProvider');
  }
  return context;
} 
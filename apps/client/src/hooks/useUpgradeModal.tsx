import type { ReactNode } from 'react';
import { useState, createContext, useContext, useCallback, useMemo } from 'react';

interface UpgradeModalContextType {
    isOpen: boolean;
    openModal: () => void;
    closeModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(undefined);

interface UpgradeModalProviderProps {
    children: ReactNode;
}

export function UpgradeModalProvider({ children }: UpgradeModalProviderProps) {
    const [isOpen, setIsOpen] = useState(false);

    const openModal = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsOpen(false);
    }, []);

    const value = useMemo(
        () => ({
            isOpen,
            openModal,
            closeModal,
        }),
        [isOpen, openModal, closeModal]
    );

    return <UpgradeModalContext.Provider value={value}> {children} </UpgradeModalContext.Provider>;
}

export function useUpgradeModal(): UpgradeModalContextType {
    const context = useContext(UpgradeModalContext);
    if (context === undefined) {
        throw new Error('useUpgradeModal must be used within an UpgradeModalProvider');
    }
    return context;
} 
import * as React from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

interface SidebarContextType {
    isMobileOpen: boolean;
    openMobileSidebar: () => void;
    closeMobileSidebar: () => void;
    toggleMobileSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const openMobileSidebar = useCallback(() => {
        setIsMobileOpen(true);
    }, []);

    const closeMobileSidebar = useCallback(() => {
        setIsMobileOpen(false);
    }, []);

    const toggleMobileSidebar = useCallback(() => {
        setIsMobileOpen(prev => !prev);
    }, []);

    const value = React.useMemo(
        () => ({
            isMobileOpen,
            openMobileSidebar,
            closeMobileSidebar,
            toggleMobileSidebar,
        }),
        [isMobileOpen, openMobileSidebar, closeMobileSidebar, toggleMobileSidebar]
    );

    return (
        <SidebarContext.Provider value={value}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
} 
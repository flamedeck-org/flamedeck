import * as React from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';
import { useSidebar } from '@/contexts/SidebarContext';

interface MobileSidebarProps {
    minimized?: boolean;
}

function MobileSidebar({ minimized = false }: MobileSidebarProps) {
    const { isMobileOpen, closeMobileSidebar } = useSidebar();
    const location = useLocation();

    // Close sidebar when route changes
    useEffect(() => {
        closeMobileSidebar();
    }, [location.pathname, closeMobileSidebar]);

    // Close sidebar on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isMobileOpen) {
                closeMobileSidebar();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isMobileOpen, closeMobileSidebar]);

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (isMobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMobileOpen]);

    if (!isMobileOpen) return null;

    return (
        <>
            {/* Mobile Sidebar - Full screen on mobile */}
            <div className="fixed inset-0 z-50 md:hidden bg-background">
                {/* Close button */}
                <div className="absolute top-4 right-4 z-[60]">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={closeMobileSidebar}
                        className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close sidebar</span>
                    </Button>
                </div>

                {/* Sidebar Content */}
                <div className="h-full w-full">
                    <Sidebar minimized={false} mobile={true} />
                </div>
            </div>
        </>
    );
}

export default React.memo(MobileSidebar); 
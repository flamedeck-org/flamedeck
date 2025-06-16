import * as React from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  noPadding?: boolean;
  isProfileView?: boolean;
  noScroll?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  hideNav = false,
  noPadding = false,
  isProfileView = false,
  noScroll = false,
  footer,
  className = '',
}) => {
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const location = useLocation();

  const isSettingsPage = location.pathname.startsWith('/settings');
  const shouldMinimizeSidebar = isProfileView || isSettingsPage;
  const conditionalElevation = isProfileView ? '' : 'z-10';
  const mainPaddingClasses = noPadding ? '' : 'px-6 md:px-8 py-6';
  const scrollClasses = noScroll ? 'overflow-hidden' : 'overflow-y-auto';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Background Elements - only show for logged in users */}
      {isLoggedIn && !isProfileView && (
        <div className="fixed inset-0 z-0 overflow-hidden bg-secondary">
          {/* <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.08] via-transparent to-yellow-500/[0.08]" />
          <div className="absolute inset-0 bg-gradient-to-tl from-yellow-400/[0.06] via-transparent to-red-500/[0.06]" /> */}
        </div>
      )}

      {!hideNav && <Navbar />}
      <div
        className={`flex-1 flex ${isLoggedIn ? 'flex-row' : 'flex-col'} overflow-hidden mt-[var(--navbar-height)]`}
      >
        {/* Desktop Sidebar - Hidden on mobile, minimized on medium, full on large+ */}
        {isLoggedIn && (
          <>
            {/* Medium screens - minimized sidebar */}
            <div className="hidden md:block lg:hidden">
              <Sidebar minimized={true} />
            </div>
            {/* Large screens - full sidebar (unless forced minimized by page type) */}
            <div className="hidden lg:block">
              <Sidebar minimized={shouldMinimizeSidebar} />
            </div>
          </>
        )}

        {/* Mobile Sidebar - Only renders when open */}
        {isLoggedIn && <MobileSidebar minimized={shouldMinimizeSidebar} />}

        <main
          className={`flex-1 h-full ${scrollClasses} ${mainPaddingClasses} ${conditionalElevation} ${className}`}
        >
          <div className={`mx-auto h-full w-full ${!user || noPadding ? '' : 'xl:max-w-7xl'}`}>
            {children}
            {footer && <div className="mt-auto m-[-1.5em] md:m-[-2em]">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

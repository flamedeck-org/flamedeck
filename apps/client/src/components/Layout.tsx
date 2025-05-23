import * as React from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  noPadding?: boolean;
  isProfileView?: boolean;
  footer?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  hideNav = false,
  noPadding = false,
  isProfileView = false,
  footer,
}) => {
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const location = useLocation();

  const isSettingsPage = location.pathname.startsWith('/settings');

  const shouldMinimizeSidebar = isProfileView || isSettingsPage;

  const conditionalElevation = isProfileView ? '' : 'z-10';
  const mainPaddingClasses = noPadding ? '' : 'px-6 md:px-8 py-6';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {!hideNav && <Navbar />}
      <div
        className={`flex-1 flex ${isLoggedIn ? 'flex-row' : 'flex-col'} overflow-hidden mt-[var(--navbar-height)]`}
      >
        {isLoggedIn && <Sidebar minimized={shouldMinimizeSidebar} />}
        <main
          className={`flex-1 h-full overflow-y-auto bg-secondary dark:bg-background ${mainPaddingClasses} ${conditionalElevation}`}
        >
          {children}
          {footer && <div className="mt-auto m-[-30px]">{footer}</div>}
        </main>
      </div>
    </div>
  );
};

export default Layout;

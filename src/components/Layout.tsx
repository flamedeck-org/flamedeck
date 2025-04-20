import React from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  noPadding?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hideNav = false, noPadding = false }) => {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const mainPaddingClasses = noPadding ? '' : 'px-6 md:px-8 py-6';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {!hideNav && <Navbar />}
      <div className={`flex-1 flex ${isLoggedIn ? 'flex-row' : 'flex-col'} overflow-hidden mt-[var(--navbar-height)]`}>
        {isLoggedIn && <Sidebar />}
        <main className={`flex-1 h-full overflow-y-auto ${mainPaddingClasses}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

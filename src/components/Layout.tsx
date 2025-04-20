import React from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hideNav = false }) => {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!hideNav && <Navbar />}
      <div className={`flex-1 flex ${isLoggedIn ? 'flex-row' : 'flex-col'} pt-16`}>
        {isLoggedIn && <Sidebar />}
        <main className="flex-1 px-6 md:px-8 py-6 overflow-y-auto">
          {children}
        </main>
      </div>
      <footer className="border-t py-4 text-center text-sm text-muted-foreground px-4">
        Professo &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Layout;

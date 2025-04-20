
import React from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hideNav = false }) => {
  return (
    <div className="min-h-screen flex flex-col">
      {!hideNav && <Navbar />}
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Speedscope Plus &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
};

export default Layout;

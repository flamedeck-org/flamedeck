import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ChevronRight } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user } = useAuth();

  return (
    <header className="border-b fixed top-0 left-0 right-0 bg-background z-50 h-16 flex items-center px-4 md:px-6">
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded">
              <img
                src="/flamestack_icon_300.webp"
                alt="FlameDeck Logo"
                width={32}
                height={32}
                className="rounded"
              />
            </div>
            <span className="text-xl font-semibold">FlameDeck</span>
          </Link>
        </div>
        <div className="flex items-center pr-2 space-x-4">
          {!user && (
            <>
              <Link 
                to="/docs"
                className="text-sm font-medium text-foreground"
              >
                API Docs
              </Link>
              <Link
                to="/login"
                className="text-sm font-medium text-foreground flex items-center"
              >
                Sign in
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Navbar;

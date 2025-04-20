
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar: React.FC = () => {
  // This would use actual user data from auth context in a real app
  const user = { email: "user@example.com" };

  const handleLogout = () => {
    // Would handle logout through Supabase auth in real implementation
    console.log("Logout clicked");
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-primary w-8 h-8 rounded flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5 text-primary-foreground"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-semibold">Speedscope Plus</span>
          </Link>
        </div>

        <nav className="hidden md:flex space-x-6">
          <Link
            to="/traces"
            className="text-foreground/80 hover:text-foreground transition-colors"
          >
            Traces
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          <Link to="/upload">
            <Button size="sm" variant="default">
              Upload Trace
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full"
                aria-label="User menu"
              >
                <Avatar>
                  <AvatarFallback className="bg-secondary">
                    {user.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-default">
                <span className="text-sm font-medium">{user.email}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

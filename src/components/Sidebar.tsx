import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ListTree, UploadCloud, LogOut } from "lucide-react"; // Import icons

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      // Optional: redirect to login page or home page after logout
      // navigate('/login'); 
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <aside className="w-64 border-r bg-background flex flex-col">
      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <NavLink
          to="/traces"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`
          }
        >
          <ListTree className="h-5 w-5" />
          <span>Traces</span>
        </NavLink>
        {/* Add other navigation items here if needed */}
      </nav>

      {/* Bottom Section */}
      <div className="px-4 py-4 border-t">
        <div className="mb-4">
          <Link to="/upload">
            <Button size="sm" variant="default" className="w-full">
              <UploadCloud className="mr-2 h-4 w-4" /> Upload Trace
            </Button>
          </Link>
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start px-3 py-2 h-auto text-left"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8 mr-3">
                <AvatarFallback className="bg-secondary">
                  {user?.email?.charAt(0).toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">
                  {user?.email ?? 'User'}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" sideOffset={10} className="w-56 mb-2">
             {/* Optional: Add account settings link */}
             {/* <DropdownMenuItem asChild><Link to="/account">Account Settings</Link></DropdownMenuItem> */}
             <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50">
               <LogOut className="mr-2 h-4 w-4"/>
               Logout
             </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

export default Sidebar; 
import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ListTree, UploadCloud, LogOut, User as UserIcon } from "lucide-react"; // Add UserIcon
import { useQuery } from "@tanstack/react-query"; // Import useQuery
import { supabase } from "@/integrations/supabase/client"; // Import supabase client
import { Database } from "@/integrations/supabase/types"; // Import Database types

type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth(); // Only get user and signOut now

  // Fetch profile using react-query
  const { data: profile, isLoading: isProfileLoading } = useQuery<UserProfileType | null, Error>({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id, // Only run if user exists
    staleTime: 5 * 60 * 1000, // Cache for 5 mins
  });

  const handleLogout = async () => {
    try {
      await signOut();
      // Optional: redirect to login page or home page after logout
      // navigate('/login'); 
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Determine display name and avatar details
  // Use profile data if available and loaded, otherwise fallback
  const displayName = !isProfileLoading && profile?.username 
    ? profile.username 
    : !isProfileLoading && profile?.first_name
    ? profile.first_name
    : user?.email || 'User';
  
  const avatarUrl = !isProfileLoading ? profile?.avatar_url : null;
  
  const nameFallback = 
    (!isProfileLoading && profile?.username?.charAt(0)) || 
    (!isProfileLoading && profile?.first_name?.charAt(0)) || 
    user?.email?.charAt(0) || 
    'U';

  return (
    <aside className="w-64 border-r bg-background flex flex-col z-10">
      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <NavLink
          to="/traces"
          className={({ isActive }) =>
            `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
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
            <Button 
              size="sm" 
              variant="default" 
              className="w-full flex items-center space-x-2"
            >
              <UploadCloud className="h-5 w-5" />
              <span>Upload Trace</span>
            </Button>
          </Link>
        </div>

        {/* User Menu - Show loading state or actual menu */}
        {isProfileLoading && user ? (
          <div className="flex items-center space-x-3 px-3 py-2">
             <UserIcon className="h-8 w-8 text-muted-foreground" />
             <div className="flex-1"><span className="text-sm text-muted-foreground">Loading...</span></div>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 h-auto text-left"
                aria-label="User menu"
              >
                <Avatar className="h-8 w-8 mr-3">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-secondary">
                    {nameFallback.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">
                    {displayName}
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
        )}
      </div>
    </aside>
  );
};

export default Sidebar; 
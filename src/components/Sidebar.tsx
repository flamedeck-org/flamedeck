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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { ListTree, UploadCloud, LogOut, User as UserIcon } from "lucide-react"; // Add UserIcon
import { useQuery } from "@tanstack/react-query"; // Import useQuery
import { supabase } from "@/integrations/supabase/client"; // Import supabase client
import { Database } from "@/integrations/supabase/types"; // Import Database types

type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

interface SidebarProps {
  minimized?: boolean;
}

const ICON_SIZE = "h-6 w-6"; // Define consistent icon size for Upload/Loading
const LIST_ICON_SIZE = "h-5 w-5"; // Define smaller size for list icon
const MINIMIZED_BUTTON_SIZE = "h-10 w-10"; // Consistent size for minimized buttons

const Sidebar: React.FC<SidebarProps> = ({ minimized = false }) => {
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
    <TooltipProvider delayDuration={0}>
      <aside className={`${minimized ? 'w-16' : 'w-64'} border-r bg-background flex flex-col z-10 transition-width duration-200`}>
        {/* Main Navigation */}
        <nav className="flex-1 px-2 py-6 space-y-2 overflow-y-auto">
          <NavLink
            to="/traces"
            className={({ isActive }) =>
              `flex items-center ${minimized ? `justify-center ${MINIMIZED_BUTTON_SIZE}` : 'space-x-2 px-3 py-2'} rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`
            }
            aria-label="Traces"
          >
            {minimized ? (
              <Tooltip disableHoverableContent={false}>
                <TooltipTrigger asChild>
                  <ListTree className={LIST_ICON_SIZE} />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={20}>
                  <p>Traces</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <ListTree className={LIST_ICON_SIZE} />
            )}
            {!minimized && <span>Traces</span>}
          </NavLink>
          {/* Add other navigation items here if needed */}
        </nav>

        {/* Bottom Section */}
        <div className={`${minimized ? 'px-2' : 'px-4'} py-4 border-t flex flex-col items-center`}>
          <div className="mb-4 w-full flex justify-center">
            <Tooltip disableHoverableContent={!minimized}>
              <TooltipTrigger asChild>
                <Link to="/upload" className={minimized ? 'w-full flex justify-center' : 'w-full'}>
                  <Button 
                    size={minimized ? "icon" : "sm"}
                    variant="default" 
                    className={`${minimized ? MINIMIZED_BUTTON_SIZE : 'w-full space-x-2'} flex items-center justify-center`}
                    title={minimized ? "Upload Trace" : undefined}
                    aria-label="Upload Trace"
                  >
                    <UploadCloud className={ICON_SIZE} />
                    {!minimized && <span>Upload Trace</span>}
                  </Button>
                </Link>
              </TooltipTrigger>
              {minimized && (
                <TooltipContent side="right">
                  <p>Upload Trace</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* User Menu - Show loading state or actual menu */}
          {isProfileLoading && user ? (
            <div className={`flex items-center justify-center ${minimized ? MINIMIZED_BUTTON_SIZE : 'space-x-3 px-3 py-2 w-full'}`}>
               <UserIcon className={ICON_SIZE} />
               {!minimized && <div className="flex-1"><span className="text-sm text-muted-foreground">Loading...</span></div>}
            </div>
          ) : (
            <Tooltip disableHoverableContent={!minimized}>
              <DropdownMenu>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`${minimized ? `${MINIMIZED_BUTTON_SIZE} justify-center p-0` : 'w-full justify-start px-3 py-2 h-auto'} flex items-center text-left`}
                      aria-label="User menu"
                      title={minimized ? displayName : undefined}
                    >
                      <Avatar className={`${minimized ? MINIMIZED_BUTTON_SIZE : 'h-8 w-8 mr-3'}`}>
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                        <AvatarFallback className="bg-secondary text-sm">
                          {nameFallback.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {!minimized && (
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">
                            {displayName}
                          </p>
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {minimized && (
                  <TooltipContent side="right">
                    <p>{displayName}</p>
                  </TooltipContent>
                )}
                <DropdownMenuContent align="end" side="right" sideOffset={10} className="w-56 mb-2">
                  {/* Optional: Add account settings link */}
                  {/* <DropdownMenuItem asChild><Link to="/account">Account Settings</Link></DropdownMenuItem> */}
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4"/>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar; 
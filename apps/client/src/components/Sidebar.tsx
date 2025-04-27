import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { ListTree, UploadCloud, LogOut, User as UserIcon, Settings as SettingsIcon } from "lucide-react"; // Add UserIcon and SettingsIcon
import { useQuery } from "@tanstack/react-query"; // Import useQuery
import { supabase } from "@/integrations/supabase/client"; // Import supabase client
import { Database } from "@/integrations/supabase/types"; // Import Database types
import { UserAvatar } from "@/components/UserAvatar"; // Import the new component

type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

interface SidebarProps {
  minimized?: boolean;
}

const ICON_SIZE = "h-6 w-6"; // Define consistent icon size for Upload/Loading
const LIST_ICON_SIZE = "h-5 w-5"; // Define smaller size for list icon
const MINIMIZED_BUTTON_SIZE = "h-10 w-10"; // Consistent size for minimized buttons

const Sidebar: React.FC<SidebarProps> = ({ minimized = false }) => {
  const { user, signOut } = useAuth(); // Only get user and signOut now
  const navigate = useNavigate(); // Get navigate function

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
      navigate('/'); // Redirect to home page after successful logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Determine display name for tooltip/text (still needed)
  const displayName = !isProfileLoading && profile?.username 
    ? profile.username 
    : !isProfileLoading && profile?.first_name
    ? profile.first_name
    : user?.email || 'User';
  
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
                <TooltipContent side="right" sideOffset={4}>
                  <p>Traces</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <ListTree className={LIST_ICON_SIZE} />
            )}
            {!minimized && <span>Traces</span>}
          </NavLink>
          {/* Settings Link */}
           <NavLink
            to="/settings"
            // Match if path starts with /settings
            isActive={(match, location) => location.pathname.startsWith('/settings')}
            className={({ isActive }) =>
              `flex items-center ${minimized ? `justify-center ${MINIMIZED_BUTTON_SIZE}` : 'space-x-2 px-3 py-2'} rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`
            }
            aria-label="Settings"
          >
            {minimized ? (
              <Tooltip disableHoverableContent={false}>
                <TooltipTrigger asChild>
                  <SettingsIcon className={LIST_ICON_SIZE} />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={4}>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <SettingsIcon className={LIST_ICON_SIZE} />
            )}
            {!minimized && <span>Settings</span>}
          </NavLink>
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
                <TooltipContent side="right" sideOffset={4}>
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
                      <UserAvatar 
                        profile={profile} 
                        currentUser={user} 
                        size="lg" // Existing size was h-8/w-8 which maps to lg
                        className={!minimized ? 'mr-3' : ''} // Add margin only when not minimized
                      />
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
                  <TooltipContent side="right" sideOffset={4}>
                    <p>{displayName}</p>
                  </TooltipContent>
                )}
                <DropdownMenuContent align="end" side="right" sideOffset={10} className="w-56 mb-2">
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
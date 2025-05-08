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
import { ListTree, UploadCloud, LogOut, User as UserIcon, Settings as SettingsIcon, Star } from "lucide-react"; // Add UserIcon, SettingsIcon, and Star
import { useQuery } from "@tanstack/react-query"; // Import useQuery
import { supabase } from "@/integrations/supabase/client"; // Import supabase client
import type { Database } from "@/integrations/supabase/types"; // Import Database types
import { UserAvatar } from "@/components/UserAvatar"; // Import the new component
import { useSubscriptionUsage } from "@/hooks/useSubscriptionUsage"; // Import the new hook
import { Progress } from "@/components/ui/progress"; // Import Progress component
import { formatDistanceToNowStrict } from 'date-fns'; // For countdown
import { useDisplayName } from "@/hooks/useDisplayName"; // Import the new hook

type UserProfileType = Database['public']['Tables']['user_profiles']['Row'];

interface SidebarProps {
  minimized?: boolean;
}

const ICON_SIZE = "h-6 w-6"; // Define consistent icon size for Upload/Loading
const LIST_ICON_SIZE = "h-5 w-5"; // Define smaller size for list icon
const MINIMIZED_BUTTON_SIZE = "h-10 w-10"; // Consistent size for minimized buttons

const Sidebar: React.FC<SidebarProps> = ({ minimized = false }) => {
  const { user, signOut, profile, profileLoading } = useAuth(); // Only get user and signOut now
  const navigate = useNavigate(); // Get navigate function

  // Use the new hook to get the display name
  const displayName = useDisplayName(profile, user);

  // Fetch subscription usage
  const { data: usageData, isLoading: isUsageLoading } = useSubscriptionUsage();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/'); // Redirect to home page after successful logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Calculate usage details for display
  const showMonthlyUsage = usageData && usageData.monthly_upload_limit !== null && usageData.monthly_uploads_used !== null;
  const monthlyUsagePercent = showMonthlyUsage
    ? (usageData.monthly_uploads_used! / usageData.monthly_upload_limit!) * 100
    : 0;
  const resetsIn = usageData?.current_period_end && showMonthlyUsage // Only show reset if showing monthly
    ? formatDistanceToNowStrict(new Date(usageData.current_period_end), { addSuffix: true })
    : null;

  // Calculate total usage details only if monthly isn't shown
  const showTotalUsage = !showMonthlyUsage && usageData && usageData.total_trace_limit !== null && usageData.current_total_traces !== null;
  const totalUsagePercent = showTotalUsage
    ? (usageData.current_total_traces! / usageData.total_trace_limit!) * 100
    : 0;

  // Helper function to title case plan name
  const formatPlanName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

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
          {/* Settings Link - FIX isActive prop */}
           <NavLink
            to="/settings"
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

        {/* --- Subscription Usage --- */}
        {!minimized && (showMonthlyUsage || showTotalUsage) && (
          <div className="px-4 pb-4 border-b">
            {showMonthlyUsage && (
              <>
                <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                  <span className="font-medium text-foreground">Monthly Uploads</span>
                  <span className="font-medium text-foreground">
                    {usageData.monthly_uploads_used} / {usageData.monthly_upload_limit}
                  </span>
                </div>
                <Progress value={monthlyUsagePercent} className="h-2" />
                {resetsIn && (
                  <div className="text-xs text-muted-foreground mt-1 text-center">
                    Resets {resetsIn}
                  </div>
                )}
              </>
            )}
            {showTotalUsage && (
              <>
                <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                  <span className="font-medium text-foreground">Total Traces</span>
                  <span className="font-medium text-foreground">
                    {usageData.current_total_traces} / {usageData.total_trace_limit}
                  </span>
                </div>
                <Progress value={totalUsagePercent} className="h-2" />
                 {/* No reset info needed for total limit */}
              </>
            )}
          </div>
        )}
        {/* --- End Subscription Usage --- */}

        {/* Bottom Section */}
        <div className={`${minimized ? 'px-2' : 'px-4'} py-4 border-t flex flex-col items-center`}>
          <div className="mb-4 w-full flex justify-center">
            <Tooltip disableHoverableContent={!minimized}>
              <TooltipTrigger asChild>
                <Link to="/upload" className={minimized ? 'w-full flex justify-center' : 'w-full'}>
                  <Button 
                    size={minimized ? "icon" : "sm"}
                    variant="primary-outline" 
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
          {(profileLoading || isUsageLoading) && user ? (
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
                        size="lg"
                        className={!minimized ? 'mr-2' : ''}
                      />
                      {!minimized && (
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">
                            {displayName}
                          </p>
                          {/* Add Plan Name Indicator */}
                          {usageData?.plan_name && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <span>{formatPlanName(usageData.plan_name)} plan</span>
                              {/* Add star for pro plan */}
                              {usageData.plan_name === 'pro' && (
                                <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                          )}
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
                  <DropdownMenuItem onClick={() => navigate('/settings/general')}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    Manage Account
                  </DropdownMenuItem>
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
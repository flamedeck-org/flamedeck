import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { ListTree, LogOut, User as UserIcon, Settings as SettingsIcon, Star, Clock, UploadCloud } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNowStrict } from 'date-fns';
import { useDisplayName } from '@/hooks/useDisplayName';
import { SidebarActionButtons } from './SidebarActionButtons';

interface SidebarProps {
  minimized?: boolean;
  mobile?: boolean;
}

const ICON_SIZE = 'h-6 w-6';
const LIST_ICON_SIZE = 'h-5 w-5';
const MINIMIZED_BUTTON_SIZE = 'h-9 w-full px-3';

const Sidebar: React.FC<SidebarProps> = ({ minimized = false, mobile = false }) => {
  const { user, signOut, profile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = useDisplayName(profile, user);
  const { data: usageData, isLoading: isUsageLoading } = useSubscriptionUsage();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const showMonthlyUsage =
    usageData && usageData.monthly_upload_limit !== null && usageData.monthly_uploads_used !== null;

  const monthlyUsagePercent = showMonthlyUsage
    ? (usageData.monthly_uploads_used! / usageData.monthly_upload_limit!) * 100
    : 0;
  const resetsIn =
    usageData?.current_period_end && showMonthlyUsage
      ? formatDistanceToNowStrict(new Date(usageData.current_period_end), { addSuffix: true })
      : null;

  const showTotalUsage =
    !showMonthlyUsage &&
    usageData &&
    usageData.total_trace_limit !== null &&
    usageData.current_total_traces !== null;
  const totalUsagePercent = showTotalUsage
    ? (usageData.current_total_traces! / usageData.total_trace_limit!) * 100
    : 0;

  const formatPlanName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={`${mobile
          ? 'w-full h-full'
          : minimized
            ? 'w-16 h-full'
            : 'w-64 h-full'
          } border-r bg-background flex flex-col z-10 transition-width duration-200 relative z-50`}
      >
        <nav className="flex-1 px-2 py-6 space-y-2 overflow-y-auto">
          <NavLink
            to="/home"
            className={({ isActive }) => {
              // Custom active check for home - active when on home page or viewing a trace
              const isHomeActive = isActive ||
                location.pathname === '/home' ||
                location.pathname.match(/^\/traces\/[^/]+\/view$/);

              return `flex items-center ${minimized ? `justify-center ${MINIMIZED_BUTTON_SIZE}` : 'space-x-2 pl-3.5 pr-3 py-2 h-9'} rounded-md text-sm font-medium transition-colors ${isHomeActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`;
            }}
            aria-label="Home"
          >
            {minimized ? (
              <Tooltip disableHoverableContent={false}>
                <TooltipTrigger asChild>
                  <UploadCloud className={LIST_ICON_SIZE} />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={16}>
                  <p>Home</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <UploadCloud className={LIST_ICON_SIZE} />
            )}
            {!minimized && <span>Home</span>}
          </NavLink>
          <NavLink
            to="/traces"
            className={({ isActive }) => {
              // Custom active check for traces - exclude trace viewing paths 
              const isTracesActive = isActive && !location.pathname.match(/^\/traces\/[^/]+\/view$/);

              return `flex items-center ${minimized ? `justify-center ${MINIMIZED_BUTTON_SIZE}` : 'space-x-2 pl-3.5 pr-3 py-2 h-9'} rounded-md text-sm font-medium transition-colors ${isTracesActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`;
            }}
            aria-label="Traces"
          >
            {minimized ? (
              <Tooltip disableHoverableContent={false}>
                <TooltipTrigger asChild>
                  <ListTree className={LIST_ICON_SIZE} />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={16}>
                  <p>Traces</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <ListTree className={LIST_ICON_SIZE} />
            )}
            {!minimized && <span>Traces</span>}
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center ${minimized ? `justify-center ${MINIMIZED_BUTTON_SIZE}` : 'space-x-2 pl-3.5 pr-3 py-2 h-9'} rounded-md text-sm font-medium transition-colors ${isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
            aria-label="Settings"
          >
            {minimized ? (
              <Tooltip disableHoverableContent={false}>
                <TooltipTrigger asChild>
                  <SettingsIcon className={LIST_ICON_SIZE} />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={16}>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <SettingsIcon className={LIST_ICON_SIZE} />
            )}
            {!minimized && <span>Settings</span>}
          </NavLink>
        </nav>

        {!minimized && (showMonthlyUsage || showTotalUsage) && (
          <div className="px-4 pb-4">
            <div className="bg-background/50 backdrop-blur-sm border border rounded-lg p-3 space-y-2">
              {showMonthlyUsage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Monthly Uploads</span>
                    <span className="text-xs font-medium text-foreground">
                      {usageData.monthly_uploads_used} / {usageData.monthly_upload_limit}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Progress
                        value={monthlyUsagePercent}
                        className="h-2 bg-muted/80"
                      />
                      <div
                        className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-red-500 to-yellow-500 transition-all duration-300"
                        style={{ width: `${Math.min(monthlyUsagePercent, 100)}%` }}
                      />
                    </div>
                    {resetsIn && (
                      <div className="text-center text-xs text-muted-foreground">
                        Resets {resetsIn}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {showTotalUsage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Total Traces</span>
                    <span className="text-xs font-medium text-foreground">
                      {usageData.current_total_traces} / {usageData.total_trace_limit}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress
                      value={totalUsagePercent}
                      className="h-2 bg-muted/80"
                    />
                    <div
                      className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-red-500 to-yellow-500 transition-all duration-300"
                      style={{ width: `${Math.min(totalUsagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={`${minimized ? 'px-2' : 'px-4'} py-4 border-t flex flex-col items-center`}>
          <SidebarActionButtons minimized={minimized} />

          {(profileLoading || isUsageLoading) && user ? (
            <div
              className={`flex items-center justify-center ${minimized ? MINIMIZED_BUTTON_SIZE : 'space-x-3 px-3 py-2 w-full'}`}
            >
              <UserIcon className={ICON_SIZE} />
              {!minimized && (
                <div className="flex-1">
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              )}
            </div>
          ) : (
            <Tooltip disableHoverableContent={!minimized}>
              <DropdownMenu>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`${minimized ? `${MINIMIZED_BUTTON_SIZE} justify-center p-0` : 'w-full justify-start pl-3.5 pr-3 py-2 h-9'} flex items-center text-left mt-4`}
                      aria-label="User menu"
                      title={minimized ? displayName : undefined}
                    >
                      <UserAvatar
                        // @ts-ignore
                        profile={profile}
                        currentUser={user}
                        size="lg"
                        className={!minimized ? 'mr-2' : ''}
                      />
                      {!minimized && (
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">{displayName}</p>
                          {usageData?.plan_name && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <span>{formatPlanName(usageData.plan_name)} plan</span>
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
                  <DropdownMenuItem
                    onClick={() => navigate('/settings/general')}
                    icon={<UserIcon className="h-4 w-4 text-muted-foreground" />}
                    iconVariant="default"
                  >
                    Manage Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    icon={<LogOut className="h-4 w-4 text-red-500" />}
                    iconVariant="primary"
                    className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  >
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

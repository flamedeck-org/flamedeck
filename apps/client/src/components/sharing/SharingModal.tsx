import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { useSharingModal } from '@/hooks/useSharingModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TraceRole, TracePermissionWithUser } from '@/lib/api';
import { traceApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  Globe,
  Link as LinkIcon,
  Loader2,
  ChevronsUpDown,
  Lock,
  Copy as CopyIconInternal,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import type { Database } from '@/integrations/supabase/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTraceDetails } from '@/hooks/useTraceDetails';
import { useDebounce } from '@/hooks/useDebounce';

// Type for user profile needed for search
type UserProfileSearchResult = Database['public']['Tables']['user_profiles']['Row'];

function SharingModalImpl() {
  const { isOpen, closeModal, traceId } = useSharingModal();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- State for Invite/Search (Top Input) ---
  const [comboboxValue, setComboboxValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserProfileSearchResult[]>([]);
  const [invitePopoverOpen, setInvitePopoverOpen] = useState(false);
  const [selectedInviteRole, setSelectedInviteRole] = useState<TraceRole>('viewer');
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  // Fetch trace details using the new hook
  const { 
    data: traceDetails, 
    isLoading: isLoadingDetails, 
    error: detailsError 
  } = useTraceDetails(traceId);

  // Fetch permissions when the modal is open and traceId is available
  const {
    data: permissionsData,
    isLoading: isLoadingPermissions,
    error: permissionsFetchError,
  } = useQuery<TracePermissionWithUser[] | null, string>({
    queryKey: ['tracePermissions', traceId],
    queryFn: async () => {
      if (!traceId) return null;
      const permResponse = await traceApi.getTracePermissions(traceId);
      if (permResponse.error) {
        throw permResponse.error;
      }
      return permResponse.data;
    },
    enabled: !!traceId && isOpen,
    staleTime: 5 * 60 * 1000,
    refetchInterval: isOpen ? 60 * 1000 : false,
    refetchOnWindowFocus: true,
  });

  // Combine loading and error states
  const isLoading = isLoadingDetails || isLoadingPermissions;
  const fetchError = detailsError?.message || permissionsFetchError;

  const permissions: TracePermissionWithUser[] = useMemo(() => permissionsData ?? [], [permissionsData]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
    }
  };

  // Calculate current public access state - Adapt later for General Access dropdown
  const publicPermission = useMemo(() => permissions.find(p => p.user === null), [permissions]);
  const isPublic = publicPermission?.role === 'viewer'; // Use this for General Access initial state

  // --- Mutations ---

  // Keep track of which permission row is currently being updated/removed
  const [mutatingPermissionId, setMutatingPermissionId] = useState<string | null>(null);

  // Mutation for setting public access (Keep, adapt later for General Access)
  const { mutate: setPublicAccess, isPending: isSettingPublicAccess } = useMutation({
    mutationFn: (makePublic: boolean) => {
      if (!traceId) throw new Error("Trace ID is missing");
      const targetRole: TraceRole | null = makePublic ? 'viewer' : null;
      return traceApi.setPublicTraceAccess(traceId, targetRole);
    },
    onSuccess: (data, makePublic) => {
      toast({ title: `Access updated`, description: makePublic ? "Trace is now public." : "Trace is now private." });
      queryClient.invalidateQueries({ queryKey: ['tracePermissions', traceId] });
    },
    onError: (error) => {
      toast({ title: "Error updating access", description: error.message, variant: "destructive" });
    },
  });

  // Mutation for adding a permission (inviting user) - Keep logic, remove UI for now
  const { mutate: inviteUser, isPending: isInvitingUser } = useMutation({
    mutationFn: (params: { userId: string; role: TraceRole }) => {
      if (!traceId) throw new Error("Trace ID is missing");
      if (!params.userId) throw new Error("User ID is missing");
      if (permissions.some(p => p.user?.id === params.userId)) {
        throw new Error("User already has access.");
      }
      return traceApi.addTracePermission(traceId, params.userId, params.role);
    },
    onSuccess: (data, params) => {
      toast({ title: "User Invited", description: `Access granted to user.` });
      queryClient.invalidateQueries({ queryKey: ['tracePermissions', traceId] });
      setComboboxValue("");
      setSearchResults([]);
      setInvitePopoverOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error Inviting User", description: error.message, variant: "destructive" });
    },
  });

  // Mutation for updating a permission role
  const { mutate: updatePermissionRole, isPending: isUpdatingRole } = useMutation({
    mutationFn: (params: { permissionId: string; role: TraceRole }) => {
      setMutatingPermissionId(params.permissionId); // Track which row is mutating
      return traceApi.updateTracePermission(params.permissionId, params.role);
    },
    onSuccess: (data, params) => {
      toast({ title: "Permission Updated" });
      queryClient.invalidateQueries({ queryKey: ['tracePermissions', traceId] });
    },
    onError: (error, params) => {
      toast({ title: "Error Updating Permission", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setMutatingPermissionId(null); // Clear tracking on completion
    }
  });

  // Mutation for removing a permission
  const { mutate: removePermission, isPending: isRemoving } = useMutation({
    mutationFn: (permissionId: string) => {
      setMutatingPermissionId(permissionId); // Track which row is mutating
      return traceApi.removeTracePermission(permissionId);
    },
    onSuccess: (data, permissionId) => {
      toast({ title: "Access Removed" });
      queryClient.invalidateQueries({ queryKey: ['tracePermissions', traceId] });
    },
    onError: (error, permissionId) => {
      toast({ title: "Error Removing Access", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setMutatingPermissionId(null); // Clear tracking on completion
    }
  });

  // --- Copy Link --- (Placeholder Function)
  const handleCopyLink = () => {
    if (!traceId) {
      toast({ title: "Error", description: "Trace ID not found.", variant: "destructive" });
      return;
    }
    const url = `${window.location.origin}/traces/${traceId}/view`;
    navigator.clipboard.writeText(url)
      .then(() => {
        toast({ title: "Link Copied" });
      })
      .catch(err => {
        toast({ title: "Error copying link", description: err.message, variant: "destructive" });
      });
  };

  // --- Calculate User Permissions ---
  const currentUserPermission = useMemo(() => permissions.find(p => p.user?.id === currentUser?.id), [permissions, currentUser]);
  const canManagePermissions = currentUserPermission?.role === 'editor' || currentUserPermission?.role === 'owner';

  // --- Search Function (Memoized) ---
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setInvitePopoverOpen(false);
      return;
    }
    setIsSearching(true);
    try {
      const response = await traceApi.searchUsers(query);
      if (response.data) {
        const existingUserIds = new Set(permissions.map(p => p.user?.id).filter(Boolean));
        const filteredResults = response.data.filter(u => u.id !== currentUser?.id && !existingUserIds.has(u.id));
        setSearchResults(filteredResults);
        // Only open popover if there are results or if it's not already open
        // This helps prevent unnecessary state updates if the popover is already open
        if (filteredResults.length > 0) {
             setInvitePopoverOpen(prev => !prev ? true : prev);
        }
      } else {
        setSearchResults([]);
        setInvitePopoverOpen(prev => !prev ? true : prev); // Keep open to show "No users found"
        console.error("Search API error:", response.error);
      }
    } catch (err) {
      console.error("Search function failed:", err);
      setSearchResults([]);
      setInvitePopoverOpen(prev => !prev ? true : prev); // Keep open to show error state?
    } finally {
      setIsSearching(false);
    }
  }, [permissions, currentUser?.id, setInvitePopoverOpen, setSearchResults, setIsSearching]); // Added state setters as dependencies

  // --- Effect to run search on debounced query change ---
  useEffect(() => {
    performSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, performSearch]); // Depend on debounced query and the memoized search function

  // Handler when selecting user from search results (triggers invite)
  const handleUserSelectAndInvite = (user: UserProfileSearchResult) => {
    setInvitePopoverOpen(false);
    setComboboxValue("");
    setSearchResults([]);
    inviteUser({ userId: user.id, role: selectedInviteRole });
  };

  // --- Handler for Role Change/Remove ---
  const handleRoleChange = (permissionId: string, newRoleOrAction: string) => {
    if (newRoleOrAction === 'remove') {
      removePermission(permissionId);
    } else if (newRoleOrAction === 'viewer' || newRoleOrAction === 'editor') {
      updatePermissionRole({ permissionId, role: newRoleOrAction });
    }
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading) {
      // Keep simple skeleton for loading state
      return (
        <div className="space-y-4 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }

    if (fetchError) {
      return (
        <Alert variant="destructive" className="m-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Fetching Permissions</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      );
    }

    // Filter out the public permission entry for list display
    const userPermissions = permissions.filter(p => p.user !== null);

    return (
      <>
        {/* Top Input Section - Now with Combobox */}
        {canManagePermissions && (
          <div>
            <Popover open={invitePopoverOpen} onOpenChange={setInvitePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={invitePopoverOpen}
                  className="w-full justify-between text-muted-foreground font-normal"
                >
                  {comboboxValue || "Add people by name or username"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command filter={(value, search) => 1}>
                  <CommandInput
                    placeholder="Search users..."
                    value={localSearchQuery}
                    onValueChange={setLocalSearchQuery}
                    disabled={isSearching}
                  />
                  <CommandList>
                    <CommandEmpty>{isSearching ? "Searching..." : "No users found."}</CommandEmpty>
                    <CommandGroup>
                      {searchResults.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.id}
                          onSelect={() => handleUserSelectAndInvite(user)}
                        >
                          <div className="flex items-center space-x-3 w-full">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={user.avatar_url ?? undefined} />
                              <AvatarFallback>
                                { (user.username || "U").substring(0, 2).toUpperCase() }
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col flex-grow min-w-0">
                              <span className="font-medium truncate text-sm">
                                {user.username || 'Unnamed User'}
                              </span>
                              {(user.first_name || user.last_name) && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {`${user.first_name || ''} ${user.last_name || ''}`.trim()}
                                </span>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* People with Access Section */}
        <div>
          <ul className="space-y-3"> {/* Increased spacing */}
            {userPermissions.map((perm) => {
              if (!perm.user) return null; // Should not happen with filtering, but safeguard

              const userDisplayName = perm.user.username || `${perm.user.first_name || ''} ${perm.user.last_name || ''}`.trim() || `User`;
              const initials = userDisplayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
              const isCurrentUser = perm.user.id === currentUser?.id;
              const isPermOwner = perm.role === 'owner';
              const isMutatingThisRow = mutatingPermissionId === perm.id;

              return (
                <li key={perm.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-3"> {/* Increased spacing */}
                    <Avatar className="h-8 w-8"> {/* Slightly larger Avatar */}
                      <AvatarImage src={perm.user.avatar_url ?? undefined} alt={userDisplayName} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {userDisplayName}
                        {isCurrentUser && ' (you)'}
                      </span>
                      {/* TODO: Check if email exists before displaying */}
                    </div>
                  </div>

                  {/* Role Dropdown / Remove Button */}
                  {isPermOwner ? (
                    <span className="text-xs text-muted-foreground px-3">Owner</span>
                  ) : (canManagePermissions && !isCurrentUser) ? (
                     <Select
                        value={perm.role}
                        onValueChange={(newValue) => handleRoleChange(perm.id, newValue)}
                        disabled={isMutatingThisRow} // Disable select during mutation for this row
                       >
                       <SelectTrigger className="w-[100px] h-8 text-xs">
                         {isMutatingThisRow ? (
                           <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                         ) : (
                           <SelectValue />
                         )}
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="viewer">Viewer</SelectItem>
                         <SelectItem value="editor">Editor</SelectItem>
                         {/* Styled Remove Item */}
                         <SelectItem value="remove" className="text-destructive focus:bg-destructive focus:text-destructive-foreground"> 
                           <div className="flex items-center w-full"> 
                             <span>Remove access</span>
                           </div>
                         </SelectItem>
                       </SelectContent>
                     </Select>
                  ) : (
                     <span className="text-xs text-muted-foreground capitalize px-3">{perm.role}</span>
                  )}
                </li>
              );
            })}
            {userPermissions.length === 0 && (
               <li className="text-sm text-muted-foreground">Only you have access.</li>
            )}
          </ul>
        </div>

        {/* General Access Section */}
        {canManagePermissions && (
             <div>
               <h4 className="font-medium text-sm mb-2">General access</h4>
               <div className="flex items-start space-x-3">
                 <div className="mt-1">
                    {isPublic ? <Globe className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                 </div>
                 <div className="flex-grow">
                    <Select
                        value={isPublic ? 'public' : 'restricted'}
                        onValueChange={(value) => setPublicAccess(value === 'public')}
                        disabled={isSettingPublicAccess}
                      >
                      <SelectTrigger className="w-full h-auto p-0 border-0 shadow-none focus:ring-0 text-left">
                         <div>
                             <p className="font-medium text-sm">{isPublic ? "Anyone with the link" : "Restricted"}</p>
                             <p className="text-xs text-muted-foreground">
                               {isPublic ? "Anyone on the internet with the link can view" : "Only people with access can open with the link"}
                              </p>
                          </div>
                          {isSettingPublicAccess
                             ? <Loader2 className="h-4 w-4 animate-spin ml-auto text-muted-foreground" />
                             : <ChevronsUpDown className="h-4 w-4 ml-auto text-muted-foreground" />
                          }
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="restricted">
                            <div className="flex items-center"><Lock className="h-4 w-4 mr-2"/>Restricted</div>
                            <p className="text-xs text-muted-foreground pl-6">Only people with access can open with the link</p>
                          </SelectItem>
                         <SelectItem value="public">
                           <div className="flex items-center"><Globe className="h-4 w-4 mr-2"/>Anyone with the link</div>
                           <p className="text-xs text-muted-foreground pl-6">Anyone on the internet with the link can view</p>
                         </SelectItem>
                       </SelectContent>
                     </Select>
                 </div>
               </div>
             </div>
         )}
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Increased max-width */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-16"> {/* Add padding to prevent overlap with close button */}
          {/* Use fetched trace name, fallback to ID or placeholder */}
          <DialogTitle className="truncate"> 
             {isLoadingDetails 
                ? <Skeleton className="h-6 w-48" /> 
                : `Share "${traceDetails?.scenario || 'Trace'}"`
             }
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {renderContent()}
        </div>
        <DialogFooter className="sm:justify-between pt-2">
          <Button type="button" variant="outline" onClick={handleCopyLink}>
             <LinkIcon className="mr-2 h-4 w-4" /> Copy link
           </Button>
          <Button type="button" onClick={closeModal} className="px-6">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const SharingModal = memo(SharingModalImpl); 
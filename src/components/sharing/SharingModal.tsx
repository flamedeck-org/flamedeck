import { memo, useMemo, useState, useCallback } from 'react';
import { useSharingModal } from '@/hooks/useSharingModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { traceApi, TraceRole } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Globe, Link as LinkIcon, Users, Loader2, Search, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { debounce } from 'lodash-es';
import { Database } from '@/integrations/supabase/types';

// Type for user profile needed for search
type UserProfileSearchResult = Database['public']['Tables']['user_profiles']['Row'];

function SharingModalImpl() {
  const { isOpen, closeModal, traceId } = useSharingModal();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- State for Invite Section ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfileSearchResult | null>(null);
  const [inviteRole, setInviteRole] = useState<TraceRole>('viewer');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserProfileSearchResult[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Fetch permissions when the modal is open and traceId is available
  const { 
    data: permissionsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['tracePermissions', traceId], // Query key includes traceId
    queryFn: () => traceId ? traceApi.getTracePermissions(traceId) : Promise.resolve({ data: null, error: 'No Trace ID' }),
    enabled: !!traceId && isOpen, // Only run query when modal is open and traceId is set
    staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    refetchInterval: isOpen ? 60 * 1000 : false,
    refetchOnWindowFocus: true,
  });

  const permissions = permissionsData?.data ?? [];
  const fetchError = permissionsData?.error || error?.message;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
    }
  };

  // Determine if the current user is the owner
  const ownerPermission = permissions.find(p => p.role === 'owner');
  const isOwner = currentUser && ownerPermission?.user?.id === currentUser.id;

  // Determine if the current user can manage permissions (Editor or Owner)
  const currentUserPermission = useMemo(() => permissions.find(p => p.user?.id === currentUser?.id), [permissions, currentUser]);
  const canManagePermissions = currentUserPermission?.role === 'editor' || currentUserPermission?.role === 'owner';

  // Calculate current public access state
  const publicPermission = useMemo(() => permissions.find(p => p.user === null), [permissions]);
  const isPublic = publicPermission?.role === 'viewer';

  // --- Debounced Search Function ---
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const response = await traceApi.searchUsers(query);
        if (response.data) {
          // Filter out users already having permission (and self)
          const existingUserIds = new Set(permissions.map(p => p.user?.id).filter(Boolean));
          const filteredResults = response.data.filter(u => !existingUserIds.has(u.id));
          setSearchResults(filteredResults);
        } else {
          setSearchResults([]);
          // Optionally show toast on search error
          console.error("Search error:", response.error);
        }
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300), // 300ms debounce delay
    [permissions] // Dependency on permissions to filter correctly
  );

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedUser(null); // Clear selected user if query changes
    debouncedSearch(value);
  };

  // Handle selecting a user from search results
  const handleUserSelect = (user: UserProfileSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.username || `${user.first_name} ${user.last_name}` || user.id); // Update input field
    setSearchResults([]); // Clear results
    setPopoverOpen(false); // Close popover
  };

  // --- Mutations ---

  // Mutation for setting public access
  const { mutate: setPublicAccess, isPending: isSettingPublicAccess } = useMutation({
    mutationFn: (makePublic: boolean) => {
      if (!traceId) throw new Error("Trace ID is missing");
      const targetRole: TraceRole | null = makePublic ? 'viewer' : null; // Set to viewer or remove
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

  // Mutation for adding a permission (inviting user)
  const { mutate: inviteUser, isPending: isInvitingUser } = useMutation({
    mutationFn: (params: { userId: string; role: TraceRole }) => {
      if (!traceId) throw new Error("Trace ID is missing");
      if (!params.userId) throw new Error("User ID is missing");
      // Prevent re-inviting someone already there (should be caught by RLS/DB too)
      if (permissions.some(p => p.user?.id === params.userId)) {
        throw new Error("User already has access.");
      }
      return traceApi.addTracePermission(traceId, params.userId, params.role);
    },
    onSuccess: (data, params) => {
      toast({ title: "User Invited", description: `Access granted to user.` });
      queryClient.invalidateQueries({ queryKey: ['tracePermissions', traceId] });
      // Reset invite form
      setSearchQuery("");
      setSelectedUser(null);
      setInviteRole('viewer');
      setSearchResults([]);
    },
    onError: (error) => {
      toast({ title: "Error Inviting User", description: error.message, variant: "destructive" });
    },
  });

  // Handle Invite button click
  const handleInviteClick = () => {
    if (selectedUser) {
      inviteUser({ userId: selectedUser.id, role: inviteRole });
    }
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      );
    }

    if (fetchError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Fetching Permissions</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      );
    }

    // Basic list display (will be improved)
    return (
      <div>
        {/* Public Access Section - Only visible to owner */}
        {canManagePermissions && (
          <div className="mb-4">
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="flex items-start space-x-3">
                <Globe className="h-6 w-6 mt-1 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="public-access-switch" className="text-base">
                    Public Access
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isPublic ? "Anyone with the link can view." : "Only invited people can access."}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {isSettingPublicAccess && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                <Switch
                  id="public-access-switch"
                  checked={isPublic}
                  onCheckedChange={setPublicAccess}
                  disabled={isSettingPublicAccess}
                />
              </div>
            </div>
          </div>
        )}

        {/* Separator */} 
        <Separator className="my-4" /> 

        {/* People with Access Section */} 
        <h4 className="font-medium mb-2">People with Access</h4>
        <ul>
          {permissions.map((perm) => (
            <li key={perm.id} className="text-sm mb-1 flex justify-between items-center">
              {perm.user ? (
                <div className="flex items-center">
                  {/* Placeholder for Avatar */} 
                  <span className="inline-block h-6 w-6 rounded-full bg-muted mr-2"></span> 
                  <span>{perm.user.username || `${perm.user.first_name} ${perm.user.last_name}` || `User ${perm.user.id.substring(0,6)}`}
                    {perm.user.id === currentUser?.id && ' (you)'}</span>
                </div>
              ) : null /* Don't show public access row here anymore */}
              {perm.user && (
                <span className="text-muted-foreground capitalize">{perm.role}</span>
              )}
              {/* TODO: Role dropdown and remove button for owner */}
            </li>
          ))}
          {/* Filter out public permission before checking length */}
          {permissions.filter(p => p.user !== null).length === 0 && (
             <li className="text-sm text-muted-foreground">Only you have access.</li>
          )}
        </ul>

        {/* Invite Users Section - Only visible to owner */} 
        {canManagePermissions && (
          <div className="mt-4 space-y-2">
             <Label htmlFor="user-search">Invite people</Label>
             <div className="flex space-x-2">
               <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative flex-grow">
                      <Input
                        id="user-search"
                        placeholder="Search by name or username..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pr-8" // Make space for loader
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                   </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}> {/* We handle filtering manually */}
                       <CommandList>
                        <CommandEmpty>{isSearching ? "Searching..." : "No users found."}</CommandEmpty>
                        <CommandGroup>
                          {searchResults.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.username}-${user.id}`} // Unique value for selection
                              onSelect={() => handleUserSelect(user)}
                            >
                              {/* Basic user display */} 
                              {user.username || `${user.first_name} ${user.last_name}` || user.id}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                 </PopoverContent>
                </Popover>

               <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as TraceRole)}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleInviteClick} 
                  disabled={!selectedUser || isInvitingUser}
                  className="w-[90px]"
                 > 
                   {isInvitingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
                 </Button>
              </div>
           </div>
         )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md"> {/* Adjusted width */}
        <DialogHeader>
          <DialogTitle>Share Trace</DialogTitle>
          <DialogDescription>
            Manage who can access this trace.
            {/* Maybe show trace name here later */}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {renderContent()}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={closeModal}>Close</Button>
          {/* Save button might be needed if changes aren't instant */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const SharingModal = memo(SharingModalImpl); 
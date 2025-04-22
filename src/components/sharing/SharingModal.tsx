import { memo, useMemo, useState, useCallback } from 'react';
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
import { traceApi, TraceRole } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  Globe,
  Link as LinkIcon,
  Users,
  Loader2,
  ChevronsUpDown,
  Lock,
  Copy as CopyIconInternal,
  Mail,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { debounce } from 'lodash-es';
import { Database } from '@/integrations/supabase/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTraceDetails } from '@/hooks/useTraceDetails';

// Type for user profile needed for search (adjust if email is missing)
type UserProfileSearchResult = Database['public']['Tables']['user_profiles']['Row'];
// Define a type for permissions that includes email (assuming it's available)
type PermissionWithEmail = NonNullable<Awaited<ReturnType<typeof traceApi.getTracePermissions>>['data']>[number] & {
  user?: UserProfileSearchResult & { email?: string | null } | null // Make user optional and add email
};

function SharingModalImpl() {
  const { isOpen, closeModal, traceId } = useSharingModal();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- State for Top Input --- (Placeholder)
  const [topInput, setTopInput] = useState("");

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
    refetch
  } = useQuery<PermissionWithEmail[] | null, string>({
    queryKey: ['tracePermissions', traceId],
    queryFn: async () => {
      if (!traceId) return null;
      const permResponse = await traceApi.getTracePermissions(traceId);
      if (permResponse.error) {
        throw permResponse.error;
      }
      return permResponse.data as PermissionWithEmail[];
    },
    enabled: !!traceId && isOpen,
    staleTime: 5 * 60 * 1000,
    refetchInterval: isOpen ? 60 * 1000 : false,
    refetchOnWindowFocus: true,
  });

  // Combine loading and error states
  const isLoading = isLoadingDetails || isLoadingPermissions;
  const fetchError = detailsError?.message || permissionsFetchError;

  const permissions: PermissionWithEmail[] = permissionsData ?? [];

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
    }
  };

  // Calculate current public access state - Adapt later for General Access dropdown
  const publicPermission = useMemo(() => permissions.find(p => p.user === null), [permissions]);
  const isPublic = publicPermission?.role === 'viewer'; // Use this for General Access initial state

  // --- Mutations ---

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
      // Reset invite form - TODO: Adapt for new top input
      // setSearchQuery("");
      // setSelectedUser(null);
      // setInviteRole('viewer');
      // setSearchResults([]);
    },
    onError: (error) => {
      toast({ title: "Error Inviting User", description: error.message, variant: "destructive" });
    },
  });

  // --- Copy Link --- (Placeholder Function)
  const handleCopyLink = () => {
    // TODO: Get trace URL and implement copy
    const url = `${window.location.origin}/trace/${traceId}`; // Example URL structure
    navigator.clipboard.writeText(url)
      .then(() => {
        toast({ title: "Link Copied" });
      })
      .catch(err => {
        toast({ title: "Error copying link", description: err.message, variant: "destructive" });
      });
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
      <div className="space-y-4">
        {/* Top Input Section */}
        {/* TODO: Implement actual multi-user input/search/invite logic */}
        <div className="px-4">
          <Input
            placeholder="Add people, groups, and calendar events"
            value={topInput}
            onChange={(e) => setTopInput(e.target.value)}
            // Add handlers for search/selection later
          />
          {/* Add invite button/role selection integrated here later */}
        </div>

        {/* People with Access Section */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-sm">People with access</h4>
            <div className="flex space-x-2">
               {/* TODO: Add functionality to these buttons */}
               <Button variant="ghost" size="icon" className="h-8 w-8">
                  <CopyIconInternal className="h-4 w-4" />
               </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Mail className="h-4 w-4" />
                </Button>
            </div>
          </div>
          <ul className="space-y-3"> {/* Increased spacing */}
            {userPermissions.map((perm) => {
              if (!perm.user) return null; // Should not happen with filtering, but safeguard

              const userDisplayName = perm.user.username || `${perm.user.first_name || ''} ${perm.user.last_name || ''}`.trim() || `User`;
              const initials = userDisplayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
              const isCurrentUser = perm.user.id === currentUser?.id;
              const isPermOwner = perm.role === 'owner';

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
                      <span className="text-xs text-muted-foreground">{perm.user.email || 'No email available'}</span>
                    </div>
                  </div>

                  {/* TODO: Implement Role Dropdown/Remove */}
                  {isPermOwner ? (
                     <span className="text-xs text-muted-foreground">Owner</span>
                  ) : (
                    // Placeholder for future role dropdown
                    <span className="text-xs text-muted-foreground capitalize">{perm.role}</span>
                    // <Select defaultValue={perm.role} onValueChange={(newRole) => {/* Handle update */}}>
                    //   <SelectTrigger className="w-[90px] h-8 text-xs">
                    //     <SelectValue />
                    //   </SelectTrigger>
                    //   <SelectContent>
                    //     <SelectItem value="viewer">Viewer</SelectItem>
                    //     <SelectItem value="editor">Editor</SelectItem>
                    //     <SelectItem value="remove">Remove access</SelectItem>
                    //   </SelectContent>
                    // </Select>
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
        {/* TODO: Implement actual dropdown logic */}
        <div className="px-4 pt-2"> {/* Added padding top */}
           <h4 className="font-medium text-sm mb-2">General access</h4>
           <div className="flex items-start space-x-3">
             <div className="mt-1">
                {isPublic ? <Globe className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
             </div>
             <div className="flex-grow">
               {/* Placeholder for future dropdown */}
                <p className="font-medium text-sm">{isPublic ? "Anyone with the link" : "Restricted"}</p>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? "Anyone on the internet with the link can view" : "Only people with access can open with the link"}
                </p>
               {/* <Select defaultValue={isPublic ? 'public' : 'restricted'} onValueChange={(value) => setPublicAccess(value === 'public')}>
                 <SelectTrigger className="w-[180px] h-8 text-sm justify-start font-medium p-0 border-0 shadow-none focus:ring-0">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="restricted">
                      <div className="flex items-center"><Lock className="h-4 w-4 mr-2"/>Restricted</div>
                      <p className="text-xs text-muted-foreground">Only people with access can open with the link</p>
                    </SelectItem>
                   <SelectItem value="public">
                     <div className="flex items-center"><Globe className="h-4 w-4 mr-2"/>Anyone with the link</div>
                     <p className="text-xs text-muted-foreground">Anyone on the internet with the link can view</p>
                   </SelectItem>
                 </SelectContent>
               </Select> */}

             </div>
           </div>
        </div>

        {/* Removed old invite section and public access toggle */}
      </div>
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
           {/* TODO: Add Help Button Action */}
           <Button variant="ghost" size="icon" className="absolute top-3 right-14 h-8 w-8">
              <HelpCircle className="h-5 w-5" />
           </Button>
        </DialogHeader>
        {/* Removed py-4 space-y-4 from wrapper div */}
        <div className="pt-2 pb-4">
          {renderContent()}
        </div>
        <DialogFooter className="sm:justify-between px-4 pb-4 pt-0"> {/* Added padding */}
          <Button type="button" variant="outline" onClick={handleCopyLink}>
             <LinkIcon className="mr-2 h-4 w-4" /> Copy link
           </Button>
          <Button type="button" onClick={closeModal}>Done</Button> {/* Changed from Close */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const SharingModal = memo(SharingModalImpl); 
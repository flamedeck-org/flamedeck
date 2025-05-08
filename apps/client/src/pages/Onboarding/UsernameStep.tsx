import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext'; // Adjust path
import { useToast } from '@/components/ui/use-toast'; // Adjust path
import { Button } from '@/components/ui/button'; // Adjust path
import { Input } from '@/components/ui/input'; // Adjust path
import { Label } from '@/components/ui/label'; // Adjust path
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Adjust path
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'; // Remove Search icon
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useQueryClient, useMutation } from '@tanstack/react-query';
// Import API functions
import { checkUsernameAvailability, updateUserProfile } from '@/lib/api/users'; // Adjust path
import { useDebounce } from '@/hooks/useDebounce'; // Import useDebounce
import { cn } from '@/lib/utils'; // Import cn utility for conditional classes

// Form values interface
interface UsernameFormValues {
  username: string;
  firstName: string;
  lastName: string;
}

// Type for availability check status
type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error' | 'invalid';

// Define AuthContextValue shape (adjust as needed, especially user type)
interface AuthContextValue {
  user: any | null; 
  refetchProfile: () => void; 
}

function UsernameStep() {
  const { user, refetchProfile } = useAuth() as AuthContextValue;
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>('idle');
  // Track the username that was *last* successfully checked as available
  const [lastAvailableUsername, setLastAvailableUsername] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger, // Used for manual validation trigger
    formState: { errors, isSubmitting, isValid: isFormValid, dirtyFields }, // Use isValid from RHF
  } = useForm<UsernameFormValues>({
    mode: 'onChange', 
    defaultValues: {
      username: '',
      firstName: '',
      lastName: '',
    }
  });

  const currentUsername = watch('username');
  const debouncedUsername = useDebounce(currentUsername, 500); // Debounce for 500ms

  // --- Automatic Availability Check --- 
  const checkAvailability = useCallback(async (usernameToCheck: string) => {
    setAvailabilityStatus('checking');
    setLastAvailableUsername(null); // Reset last available on new check
    try {
      const { data: isAvailable, error } = await checkUsernameAvailability(usernameToCheck);
      if (error) {
        console.error("Availability Check Error:", error);
        setAvailabilityStatus('error');
        // No toast here, UI indicator is enough
      } else {
        setAvailabilityStatus(isAvailable ? 'available' : 'taken');
        if (isAvailable) {
          setLastAvailableUsername(usernameToCheck); // Store the last known available name
        } 
      }
    } catch (e) {
      setAvailabilityStatus('error');
      // No toast here
    } 
  }, []); // No external dependencies needed now

  // Effect to trigger debounced check
  useEffect(() => {
    // Reset status if input is cleared or invalid based on pattern/length
    const validateInput = async () => {
      const isValidSyntax = await trigger('username'); // Manually trigger validation
      if (!debouncedUsername || !isValidSyntax) {
          setAvailabilityStatus(debouncedUsername ? 'invalid' : 'idle');
          setLastAvailableUsername(null);
          return false;
      }
      return true;
    }

    validateInput().then(isValid => {
        if (isValid && debouncedUsername) {
            console.log("Debounced username changed, checking availability:", debouncedUsername);
            checkAvailability(debouncedUsername.trim());
        }
    });

  }, [debouncedUsername, checkAvailability, trigger]);

  // --- Form Submission --- 
  const updateUsernameMutation = useMutation({
    mutationFn: async (formData: UsernameFormValues) => {
      if (!user) throw new Error('User not authenticated');
      if (formData.username !== lastAvailableUsername) {
          throw new Error('Username changed since availability check. Please wait for the check to complete.')
      }
      const { error } = await updateUserProfile(user.id, {
          username: formData.username.trim(),
          first_name: formData.firstName.trim() || null,
          last_name: formData.lastName.trim() || null,
       });
      if (error) {
          if (error.code === '23505') { 
             throw new Error('Username conflict. It might have been taken.');
          } else {
            throw new Error(error.message || 'Failed to update username');
          }
      }
      return true;
    },
    onSuccess: async () => {
      try {
          console.log("[UsernameStep] Invalidating and awaiting refetch for userProfile query...");
          await queryClient.refetchQueries({ queryKey: ['userProfile', user?.id], exact: true });
          console.log("[UsernameStep] userProfile query refetched.");
          const from = location.state?.from?.pathname || '/'; 
          console.log("[UsernameStep] Navigating after successful update and refetch to:", from);
          navigate(from, { replace: true });
      } catch (refetchError) {
          console.error("[UsernameStep] Error refetching profile after update:", refetchError);
          toast({ title: "Navigation Error", description: "Profile updated, but failed to refresh data for navigation.", variant: "destructive" });
          // Stay on the page or navigate somewhere safe?
          // Maybe just let the user manually navigate or refresh.
      }
    },
    onError: (error: Error) => {
        console.error("Error updating username:", error);
        toast({ 
            title: "Update Failed", 
            description: error.message || "Could not update username.", 
            variant: "destructive" 
        });
        setAvailabilityStatus('idle'); 
        setLastAvailableUsername(null);
    }
  });

  const onSubmit: SubmitHandler<UsernameFormValues> = (data) => {
     if (data.username !== lastAvailableUsername || availabilityStatus !== 'available') {
        toast({ title: "Username Issue", description: "Please ensure the username is available before saving.", variant: "destructive" });
        return;
     }
     updateUsernameMutation.mutate(data);
  };

  // Determine submit button disabled state
  const isSubmitDisabled = 
    !isFormValid || // Ensure basic form validation passes
    availabilityStatus !== 'available' || // Must be checked and available
    currentUsername !== lastAvailableUsername || // Submitted name must match last available check
    isSubmitting || 
    updateUsernameMutation.isPending;

  // Determine input outline class
  const getInputOutlineClass = () => {
      if (!currentUsername || availabilityStatus === 'idle' || availabilityStatus === 'invalid') return ''; // Default
      if (availabilityStatus === 'checking') return 'ring-1 ring-offset-1 ring-blue-500'; // Checking
      if (availabilityStatus === 'available') return 'ring-2 ring-offset-0 ring-green-500'; // Available (thicker)
      if (availabilityStatus === 'taken' || availabilityStatus === 'error') return 'ring-2 ring-offset-0 ring-red-500'; // Taken/Error (thicker)
      return '';
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background z-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Choose your Username</CardTitle>
          <CardDescription className="text-center">
            Pick a unique username for your FlameDeck account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="flex items-center space-x-2 relative"> {/* Make relative for spinner */} 
                <Input
                  id="username"
                  autoComplete="off"
                  className={cn("pr-10", getInputOutlineClass())} // Add padding for icon, apply conditional class
                  {...register('username', {
                    required: 'Username is required',
                    minLength: {
                      value: 3,
                      message: 'Username must be at least 3 characters'
                    },
                    maxLength: {
                      value: 30,
                      message: 'Username cannot exceed 30 characters'
                    },
                    pattern: {
                      value: /^[a-zA-Z0-9_]+$/,
                      message: 'Only letters, numbers, and underscores allowed'
                    }
                  })}
                  placeholder="e.g., profiler_pro"
                  disabled={isSubmitting || updateUsernameMutation.isPending}
                  aria-invalid={errors.username || availabilityStatus === 'taken' ? "true" : "false"}
                />
                {/* Status Indicator Inside Input */}
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {availabilityStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {availabilityStatus === 'available' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {(availabilityStatus === 'taken' || availabilityStatus === 'error' || (!!errors.username && availabilityStatus === 'invalid')) && 
                     <XCircle className="h-5 w-5 text-red-500" />
                    }
                </div>
              </div>
              {/* Conditionally show required error for username */}
              {errors.username && (errors.username.type === 'required' && dirtyFields.username) && (
                 <p role="alert" className="text-sm text-destructive mt-1">{errors.username.message}</p>
              )}
              {/* Show other username errors immediately */}
              {errors.username && errors.username.type !== 'required' && (
                  <p role="alert" className="text-sm text-destructive mt-1">{errors.username.message}</p>
              )}
               {/* Display Specific Status Messages (Optional) */}
               {availabilityStatus === 'taken' && (
                 <p className="text-sm text-destructive mt-1">Username is already taken.</p>
               )}
               {availabilityStatus === 'error' && (
                 <p className="text-sm text-destructive mt-1">Could not check username availability.</p>
               )}
               
               <p className="text-sm text-muted-foreground pt-1">
                 (Letters, numbers, underscores only. 3-30 characters)
               </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  {...register('firstName', {
                      required: 'First name is required',
                      maxLength: { value: 50, message: 'First name cannot exceed 50 characters'}
                  })}
                  placeholder="Your first name"
                  disabled={isSubmitting || updateUsernameMutation.isPending}
                  aria-invalid={errors.firstName ? "true" : "false"}
                />
                {errors.firstName && (
                    <p role="alert" className="text-sm text-destructive mt-1">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                   {...register('lastName', {
                      required: 'Last name is required',
                      maxLength: { value: 50, message: 'Last name cannot exceed 50 characters'}
                  })}
                  placeholder="Your last name"
                  disabled={isSubmitting || updateUsernameMutation.isPending}
                  aria-invalid={errors.lastName ? "true" : "false"}
                />
                 {errors.lastName && (
                    <p role="alert" className="text-sm text-destructive mt-1">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitDisabled}
            >
              {(isSubmitting || updateUsernameMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {(isSubmitting || updateUsernameMutation.isPending) ? 'Saving...' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default UsernameStep; // No `memo` here as it's a page-level component 
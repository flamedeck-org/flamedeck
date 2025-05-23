import { useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Skeleton } from '@/components/ui/skeleton';
import { updateUserProfile, deleteUserAccount } from '@/lib/api/users';

interface UserProfileFormValues {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

// Loading skeleton component for form fields
const FormFieldSkeleton = ({ label }: { label: string }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Skeleton className="h-10 w-full" />
  </div>
);

function SettingsPage() {
  const { user, signOut, profile, profileLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserProfileFormValues>({
    defaultValues: {
      username: '',
      firstName: '',
      lastName: '',
      email: user?.email || '',
    },
  });

  const isLoading = profileLoading;
  const isError = false;

  useEffect(() => {
    if (profile) {
      reset({
        username: profile.username || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: user?.email || '',
      });
    }
  }, [profile, reset, user?.email]);

  const updateProfileMutation = useMutation({
    mutationFn: async (formData: UserProfileFormValues) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await updateUserProfile(user.id, {
        username: formData.username,
        first_name: formData.firstName,
        last_name: formData.lastName,
      });

      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await deleteUserAccount();

      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: async () => {
      toast.success('Your account has been deleted');
      await signOut();
    },
    onError: (error) => {
      console.error('Error deleting account:', error);
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });

  const onSubmit = (data: UserProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  return (
    <>
      {isLoading ? (
        <Skeleton className="h-10 w-48 mb-6" />
      ) : (
        <PageHeader title="General Settings" />
      )}

      <div className="space-y-8">
        {/* Profile Form Card */}
        <Card>
          <CardHeader>
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : (
              <>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </>
            )}
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {isLoading ? (
                <>
                  <FormFieldSkeleton label="Email" />
                  <FormFieldSkeleton label="Username" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormFieldSkeleton label="First Name" />
                    <FormFieldSkeleton label="Last Name" />
                  </div>
                </>
              ) : isError ? (
                <div className="p-4 text-destructive flex items-center space-x-2 border border-destructive/20 rounded-md bg-destructive/10">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>Failed to load profile data. Please try refreshing the page.</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" {...register('email')} disabled />
                    <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      {...register('username')}
                      placeholder="Username"
                      disabled
                    />
                    {errors.username && (
                      <p className="text-sm text-destructive">{errors.username.message}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Usernames cannot currently be changed after signup.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" {...register('firstName')} placeholder="First Name" />
                      {errors.firstName && (
                        <p className="text-sm text-destructive">{errors.firstName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" {...register('lastName')} placeholder="Last Name" />
                      {errors.lastName && (
                        <p className="text-sm text-destructive">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter>
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <Button type="submit" disabled={isLoading || updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>

        {/* Danger Zone Card */}
        <Card className="border-destructive">
          <CardHeader>
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-56" />
              </>
            ) : (
              <>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible account actions</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <div className="flex items-start space-x-2 mb-4">
                  <Skeleton className="h-5 w-5 mt-0.5 flex-shrink-0 rounded-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-10 w-32" />
              </>
            ) : (
              <>
                <div className="flex items-start space-x-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Once you delete your account, there is no going back. This action is permanent
                    and will remove all your data including traces, comments, and profile
                    information.
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and
                        remove all of your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={deleteAccountMutation.isPending}
                      >
                        {deleteAccountMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default SettingsPage;

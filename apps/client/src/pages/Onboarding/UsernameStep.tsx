import React, { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client'; // Adjust path as needed
import { useAuth } from '@/contexts/AuthContext'; // Adjust path as needed
import { useToast } from '@/components/ui/use-toast'; // Adjust path as needed
import { Button } from '@/components/ui/button'; // Adjust path as needed
import { Input } from '@/components/ui/input'; // Adjust path as needed
import { Label } from '@/components/ui/label'; // Adjust path as needed
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Adjust path as needed
import { Loader2 } from 'lucide-react';

// Define the shape of the profile object you expect from useAuth
// Keep consistent with ProtectedRoute.tsx
interface UserProfile {
  id: string;
  username: string | null;
  // other profile fields...
}

// Define the shape of the AuthContext value
// Keep consistent with ProtectedRoute.tsx
interface AuthContextValue {
  user: any | null; // Replace 'any' with your actual user type if known
  profile: UserProfile | null;
  loading: boolean; 
  profileLoading: boolean; 
  refetchProfile: () => Promise<void>; // Add function to refetch profile
}

function UsernameStep() {
  const { user, refetchProfile } = useAuth() as AuthContextValue;
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    if (!username.trim()) {
      toast({ title: "Validation Error", description: "Username cannot be empty.", variant: "destructive" });
      return;
    }
    // Basic validation (you might want more robust checks)
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        toast({ 
            title: "Invalid Username", 
            description: "Username must be 3-30 characters and contain only letters, numbers, or underscores.", 
            variant: "destructive" 
        });
        return;
    }


    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: username.trim() })
        .eq('id', user.id);

      if (error) {
          // Check for unique constraint violation
          if (error.code === '23505') { // PostgreSQL unique violation code
             toast({ title: "Username Taken", description: "This username is already taken. Please choose another.", variant: "destructive" });
          } else {
            throw error; // Re-throw other errors
          }
      } else {
        toast({ title: "Success", description: "Username set successfully!" });
        // Refetch the profile in context to update the app state
        await refetchProfile(); 
        
        // Navigate user away - check if we were sent here from a specific page
        const from = location.state?.from?.pathname || '/traces'; // Default to /traces
        navigate(from, { replace: true });
      }
    } catch (error: any) {
        console.error("Error updating username:", error);
        toast({ 
            title: "Update Failed", 
            description: error.message || "Could not update username. Please try again.", 
            variant: "destructive" 
        });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Choose your Username</CardTitle>
          <CardDescription className="text-center">
            Pick a unique username for your FlameDeck account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., profiler_pro"
                required
                disabled={isLoading}
                minLength={3}
                maxLength={30}
                pattern="^[a-zA-Z0-9_]+$" // HTML pattern matches regex above
              />
               <p className="text-sm text-muted-foreground">
                 (Letters, numbers, underscores only. 3-30 characters)
               </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? 'Saving...' : 'Save Username'}
            </Button>
          </form>
        </CardContent>
         <CardFooter className="text-xs text-muted-foreground text-center block">
           You can change this later in your settings.
         </CardFooter>
      </Card>
    </div>
  );
}

export default UsernameStep; // No `memo` here as it's a page-level component 
'use client';

import { useState } from 'react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, AlertCircle } from 'lucide-react';

export function UserMenu() {
  const { user, isLoading, error } = useCurrentUser();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />;
  }

  if (error) {
    return (
      <button
        onClick={() => window.location.reload()}
        className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
        title="Erreur de session - cliquez pour rafraîchir"
      >
        <AlertCircle className="w-4 h-4 text-red-500" />
      </button>
    );
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await authClient.signOut();
    } catch (err) {
      console.error('[Auth] Sign out failed:', err);
    } finally {
      router.push('/login');
    }
  };

  const initials =
    user.name
      ?.split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
          <Avatar>
            {user.image && <AvatarImage src={user.image} alt={user.name || ''} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Deconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

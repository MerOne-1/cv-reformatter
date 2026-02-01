'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Settings, LogOut, User, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { authClient } from '@/lib/auth-client';

export function CVHeader() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleLogout = async () => {
    await authClient.signOut();
    router.refresh();
    router.push('/login');
  };

  return (
    <header className="flex-shrink-0 h-14 border-b border-border flex items-center justify-between px-4 bg-background-elevated relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-dreamit/50 to-transparent" />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-dreamit flex items-center justify-center shadow-lg shadow-dreamit/20">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight">CV Reformatter</h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {session?.user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/80">{session.user.name}</span>
          </div>
        )}
        <ThemeToggle />
        <Link href="/preferences" title="Préférences">
          <Button variant="ghost" size="icon-sm">
            <Palette className="w-4 h-4" />
          </Button>
        </Link>
        <Link href="/settings" title="Paramètres">
          <Button variant="ghost" size="icon-sm">
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleLogout}
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}

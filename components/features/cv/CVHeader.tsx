'use client';

import Link from 'next/link';
import { FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/features/auth/user-menu';

export function CVHeader() {
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
        <ThemeToggle />
        <Link href="/settings">
          <Button variant="ghost" size="icon-sm">
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

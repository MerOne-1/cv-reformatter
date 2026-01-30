'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light', savedTheme === 'light');
    } else if (!prefersDark) {
      setTheme('light');
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  if (!mounted) {
    return (
      <button className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center">
        <div className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300',
        'bg-secondary/50 hover:bg-secondary border border-border',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
      )}
      title={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
    >
      <Sun
        className={cn(
          'absolute w-4 h-4 transition-all duration-300',
          theme === 'dark'
            ? 'rotate-0 scale-100 text-warning'
            : 'rotate-90 scale-0 text-warning'
        )}
      />
      <Moon
        className={cn(
          'absolute w-4 h-4 transition-all duration-300',
          theme === 'light'
            ? 'rotate-0 scale-100 text-dreamit'
            : '-rotate-90 scale-0 text-dreamit'
        )}
      />
    </button>
  );
}

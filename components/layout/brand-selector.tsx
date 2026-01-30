'use client';

import { Brand } from '@prisma/client';
import { cn } from '@/lib/utils';

interface BrandSelectorProps {
  value: Brand;
  onChange: (value: Brand) => void;
  disabled?: boolean;
}

export function BrandSelector({ value, onChange, disabled }: BrandSelectorProps) {
  return (
    <div className="inline-flex p-1 bg-secondary/50 rounded-lg border border-border text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('DREAMIT')}
        className={cn(
          'relative px-3 py-1.5 rounded-md font-medium transition-all duration-200 ease-out-expo',
          value === 'DREAMIT'
            ? 'bg-card text-dreamit shadow-sm border border-dreamit/20'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cn(
            'w-2 h-2 rounded-full transition-all duration-200',
            value === 'DREAMIT'
              ? 'gradient-dreamit shadow-sm shadow-dreamit/50'
              : 'bg-dreamit/30'
          )} />
          <span>DreamIT</span>
        </span>
        {value === 'DREAMIT' && (
          <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-dreamit to-transparent" />
        )}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('RUPTURAE')}
        className={cn(
          'relative px-3 py-1.5 rounded-md font-medium transition-all duration-200 ease-out-expo',
          value === 'RUPTURAE'
            ? 'bg-card text-rupturae shadow-sm border border-rupturae/20'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cn(
            'w-2 h-2 rounded-full transition-all duration-200',
            value === 'RUPTURAE'
              ? 'gradient-rupturae shadow-sm shadow-rupturae/50'
              : 'bg-rupturae/30'
          )} />
          <span>Rupturae</span>
        </span>
        {value === 'RUPTURAE' && (
          <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-rupturae to-transparent" />
        )}
      </button>
    </div>
  );
}

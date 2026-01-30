import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-secondary text-secondary-foreground border border-border',
        secondary:
          'bg-muted text-muted-foreground',
        destructive:
          'bg-destructive/15 text-destructive border border-destructive/20',
        outline:
          'border border-border bg-transparent text-foreground',
        // Status variants with glow effect
        pending:
          'bg-muted text-muted-foreground border border-border',
        extracted:
          'bg-info/15 text-info border border-info/25',
        editing:
          'bg-warning/15 text-warning border border-warning/25',
        improved:
          'bg-rupturae/15 text-rupturae border border-rupturae/25',
        generated:
          'bg-success/15 text-success border border-success/25',
        completed:
          'bg-success text-white border border-success-glow/30 shadow-sm shadow-success/20',
        // Brand variants
        dreamit:
          'bg-dreamit/15 text-dreamit border border-dreamit/25',
        rupturae:
          'bg-rupturae/15 text-rupturae border border-rupturae/25',
      },
      size: {
        default: 'text-xs px-2.5 py-1',
        sm: 'text-[10px] px-2 py-0.5',
        lg: 'text-sm px-3 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: string;
}

function Badge({ className, variant, size, dot, dotColor, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            dotColor || 'bg-current'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };

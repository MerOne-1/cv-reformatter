import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 ease-out-expo focus-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 press-effect select-none',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 hover:shadow-elevated',
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90',
        outline:
          'border border-border bg-transparent hover:bg-secondary hover:border-border/80 text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50',
        ghost:
          'hover:bg-secondary/60 text-muted-foreground hover:text-foreground',
        link:
          'text-dreamit underline-offset-4 hover:underline',
        dreamit:
          'gradient-dreamit text-white shadow-lg shadow-dreamit/25 hover:shadow-xl hover:shadow-dreamit/30 hover:-translate-y-0.5 border border-dreamit-glow/20',
        rupturae:
          'gradient-rupturae text-white shadow-lg shadow-rupturae/25 hover:shadow-xl hover:shadow-rupturae/30 hover:-translate-y-0.5 border border-rupturae-glow/20',
        'dreamit-subtle':
          'bg-dreamit/10 text-dreamit border border-dreamit/20 hover:bg-dreamit/20 hover:border-dreamit/30',
        'rupturae-subtle':
          'bg-rupturae/10 text-rupturae border border-rupturae/20 hover:bg-rupturae/20 hover:border-rupturae/30',
      },
      size: {
        default: 'h-10 px-5 py-2.5 rounded-lg',
        sm: 'h-9 px-4 rounded-lg text-xs',
        lg: 'h-12 px-7 rounded-xl text-base',
        xl: 'h-14 px-8 rounded-xl text-base font-semibold',
        icon: 'h-10 w-10 rounded-lg',
        'icon-sm': 'h-8 w-8 rounded-md',
        'icon-lg': 'h-12 w-12 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'ghost';
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', interactive = false, ...props }, ref) => {
    const variants = {
      default: 'bg-card border border-border',
      elevated: 'bg-card border border-border shadow-elevated',
      bordered: 'bg-transparent border-2 border-border',
      ghost: 'bg-transparent',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl text-card-foreground transition-all duration-200',
          variants[variant],
          interactive && 'cursor-pointer hover:bg-card-hover hover:border-border/80 hover:-translate-y-0.5',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-5', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-display text-xl font-medium tracking-tight leading-none',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-5 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// New: Card with accent bar
interface AccentCardProps extends CardProps {
  accentColor?: 'dreamit' | 'rupturae' | 'success' | 'warning' | 'info';
  accentPosition?: 'left' | 'top';
}

const AccentCard = React.forwardRef<HTMLDivElement, AccentCardProps>(
  ({ className, accentColor = 'dreamit', accentPosition = 'left', children, ...props }, ref) => {
    const colorMap = {
      dreamit: 'from-dreamit to-dreamit-glow',
      rupturae: 'from-rupturae to-rupturae-glow',
      success: 'from-success to-success-glow',
      warning: 'from-warning to-warning-glow',
      info: 'from-info to-info-glow',
    };

    return (
      <Card ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <div
          className={cn(
            'absolute bg-gradient-to-b',
            colorMap[accentColor],
            accentPosition === 'left' ? 'left-0 top-0 bottom-0 w-1' : 'top-0 left-0 right-0 h-1 bg-gradient-to-r'
          )}
        />
        {children}
      </Card>
    );
  }
);
AccentCard.displayName = 'AccentCard';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  AccentCard,
};

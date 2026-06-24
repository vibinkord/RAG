import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  ...props
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors",
        {
          "bg-zinc-900 border-zinc-800 text-zinc-100": variant === 'default',
          "bg-zinc-800 border-transparent text-zinc-300": variant === 'secondary',
          "bg-emerald-950/50 border-emerald-900 text-emerald-400": variant === 'success',
          "bg-amber-950/50 border-amber-900 text-amber-400": variant === 'warning',
          "bg-red-950/50 border-red-900 text-red-400": variant === 'destructive',
        },
        className
      )}
      {...props}
    />
  );
};

import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-white text-black hover:bg-zinc-200": variant === 'primary',
          "bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-800": variant === 'secondary',
          "bg-transparent text-zinc-100 border border-zinc-800 hover:bg-zinc-900/50": variant === 'outline',
          "bg-red-950 text-red-200 hover:bg-red-900 border border-red-900": variant === 'danger',
          "bg-transparent hover:bg-zinc-950 text-zinc-400 hover:text-zinc-100": variant === 'ghost',
        },
        {
          "h-8 px-3 text-xs": size === 'sm',
          "h-10 px-4 py-2 text-sm": size === 'md',
          "h-12 px-6 text-base": size === 'lg',
        },
        className
      )}
      {...props}
    />
  );
};

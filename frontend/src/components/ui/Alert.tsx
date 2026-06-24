import React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'info';
}

export const Alert: React.FC<AlertProps> = ({
  className,
  variant = 'default',
  ...props
}) => {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
        {
          "bg-zinc-950 border-zinc-800 text-zinc-300 [&>svg]:text-zinc-300": variant === 'default',
          "bg-red-950/20 border-red-900 text-red-300 [&>svg]:text-red-400": variant === 'destructive',
          "bg-zinc-900/50 border-zinc-800 text-zinc-300 [&>svg]:text-indigo-400": variant === 'info',
        },
        className
      )}
      {...props}
    />
  );
};

export const AlertTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h5 className={cn("mb-1 font-semibold leading-none tracking-tight text-sm", className)} {...props} />
);

export const AlertDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <div className={cn("text-xs leading-relaxed text-zinc-400", className)} {...props} />
);

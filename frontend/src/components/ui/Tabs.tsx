import React from 'react';
import { cn } from '../../lib/utils';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => {
  return (
    <div className={cn("w-full", className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { activeValue: value, onValueChange } as React.HTMLAttributes<HTMLElement> & { activeValue?: string, onValueChange?: (value: string) => void });
        }
        return child;
      })}
    </div>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  activeValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ children, activeValue, onValueChange, className }) => {
  return (
    <div className={cn("inline-flex h-9 items-center justify-center rounded bg-zinc-900 p-1 text-zinc-400 border border-zinc-800", className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { 
            activeValue, 
            onClick: () => onValueChange?.(child.props.value) 
          } as React.HTMLAttributes<HTMLElement> & { activeValue?: string });
        }
        return child;
      })}
    </div>
  );
};

interface TabsTriggerProps {
  value: string;
  activeValue?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, activeValue, onClick, children, className }) => {
  const isActive = value === activeValue;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        isActive 
          ? "bg-zinc-800 text-zinc-100 shadow" 
          : "hover:text-zinc-200 text-zinc-400",
        className
      )}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  activeValue?: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, activeValue, children, className }) => {
  const isActive = value === activeValue;
  if (!isActive) return null;
  return <div className={cn("mt-4 focus-visible:outline-none", className)}>{children}</div>;
};

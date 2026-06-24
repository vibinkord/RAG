import React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      {/* Dialog content */}
      <div className="relative z-10 w-full max-w-md rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-900">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
};

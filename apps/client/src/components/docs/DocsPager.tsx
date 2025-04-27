import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface DocsPagerProps {
  title: string;
  href: string;
}

export function DocsPager({ title, href }: DocsPagerProps) {
  return (
    <div className="mt-12 w-full md:max-w-sm md:ml-auto">
      <Link
        to={href}
        className={cn(
          "relative flex flex-col items-end rounded-lg border p-4 hover:bg-muted transition-colors",
          "text-foreground no-underline hover:no-underline"
        )}
      >
        <span className="text-xs text-muted-foreground mb-1">Next</span>
        <div className="flex items-center text-primary">
          <span className="text-lg font-semibold mr-2">{title}</span>
          <ArrowRight className="h-5 w-5" />
        </div>
      </Link>
    </div>
  );
} 
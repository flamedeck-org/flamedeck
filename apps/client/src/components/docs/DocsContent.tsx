import { memo, type ReactNode } from 'react';

interface DocsContentProps {
  children: ReactNode;
}

function DocsContent({ children }: DocsContentProps) {
  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-8 lg:p-12">
      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-h1:text-2xl prose-h1:font-bold prose-h1:tracking-tight prose-h2:text-xl prose-h2:font-semibold prose-h3:text-lg prose-h3:font-medium prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground">
        {children}
      </div>
    </div>
  );
}

export default memo(DocsContent);

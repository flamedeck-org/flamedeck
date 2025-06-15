import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        // Style headings
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
        // Style paragraphs
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        // Style lists
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        // Style inline code
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          return isBlock ? (
            <pre className="bg-muted/60 dark:bg-muted/80 border border-border/40 rounded p-2 text-xs font-mono overflow-x-auto mb-2">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="px-1.5 py-0.5 mx-0.5 bg-muted/60 dark:bg-muted/80 border border-border/40 rounded text-xs font-mono">
              {children}
            </code>
          );
        },
        // Style blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-border/50 pl-4 italic mb-2">
            {children}
          </blockquote>
        ),
        // Style strong/bold
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        // Style emphasis/italic
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

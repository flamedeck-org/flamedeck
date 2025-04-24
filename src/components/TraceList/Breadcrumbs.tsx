import { memo } from 'react';
import { Folder } from '@/lib/api'; // Import Folder type
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BreadcrumbsProps {
  path: Folder[]; // Array of folders representing the path from root
  onNavigate: (folderId: string | null) => void; // Function to navigate to a specific folder ID (null for root)
}

function BreadcrumbsComponent({ path, onNavigate }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm text-muted-foreground">
      {/* Root button */}
      <Button
        variant="ghost"
        size="sm"
        className={`pl-0 pr-2 py-1 h-auto ${path.length === 0 ? 'text-foreground font-medium' : 'hover:underline'}`}
        onClick={() => onNavigate(null)} // Navigate to root
        disabled={path.length === 0} // Disable if already at root
        aria-current={path.length === 0 ? 'page' : undefined}
      >
        <Home className="h-4 w-4 mr-1.5 flex-shrink-0" />
        My Traces
      </Button>

      {/* Path segments */}
      {path.map((folder, index) => {
        const isLast = index === path.length - 1;
        return (
          <div key={folder.id} className="flex items-center space-x-1">
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              className={`px-2 py-1 h-auto truncate ${isLast ? 'text-foreground font-medium' : 'hover:underline'}`}
              onClick={() => onNavigate(folder.id)}
              disabled={isLast} // Disable the last item (current folder)
              aria-current={isLast ? 'page' : undefined}
            >
              {folder.name}
            </Button>
          </div>
        );
      })}
    </nav>
  );
}

export const Breadcrumbs = memo(BreadcrumbsComponent); 
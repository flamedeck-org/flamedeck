import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils'; // Assuming you have a utility for class names
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu, BookOpen, Key, Terminal, Package, Smartphone } from 'lucide-react';

// Modify DocsSidebarNav to accept onLinkClick
interface DocsSidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  onLinkClick?: () => void; // Optional callback
}

interface DocsNavLinkProps {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ElementType;
}

function DocsNavLink({ to, children, onClick, icon: Icon }: DocsNavLinkProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary/5 hover:text-primary',
          isActive
            ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
            : 'text-muted-foreground hover:shadow-sm'
        )
      }
    >
      {Icon && (
        <Icon className="h-4 w-4 transition-colors group-hover:text-primary" />
      )}
      {children}
    </NavLink>
  );
}

function DocsSidebarNav({ className, onLinkClick, ...props }: DocsSidebarNavProps) {
  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <div className={cn('space-y-1', className)} {...props}>
      <div className="px-3 py-2">
        <h2 className="mb-2 px-1 text-lg font-semibold tracking-tight flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Documentation
        </h2>
        <p className="px-1 text-xs text-muted-foreground mb-4">
          Learn how to integrate FlameDeck into your workflow
        </p>
      </div>
      <nav className="space-y-1">
        <DocsNavLink to="/docs/api-keys" onClick={handleLinkClick} icon={Key}>
          API Keys
        </DocsNavLink>
        <DocsNavLink to="/docs/cli-upload" onClick={handleLinkClick} icon={Terminal}>
          CLI Upload
        </DocsNavLink>
        <DocsNavLink to="/docs/npm-upload" onClick={handleLinkClick} icon={Package}>
          NPM Package Upload
        </DocsNavLink>
        <DocsNavLink to="/docs/react-native" onClick={handleLinkClick} icon={Smartphone}>
          React Native Upload
        </DocsNavLink>
      </nav>
    </div>
  );
}

export default function DocsLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col pt-16 bg-background">
      <div className="flex-1 items-start md:grid md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)] z-10">
        {/* Desktop Sidebar */}
        <aside className="fixed top-16 z-30 hidden h-[calc(100vh-4rem)] w-full shrink-0 md:sticky md:block overflow-y-auto border-r border-border/50 bg-card/80 backdrop-blur-sm">
          <div className="p-6">
            <DocsSidebarNav />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="relative bg-background">
          <div className="xl:max-w-7xl mx-auto w-full p-6 lg:p-8">
            {/* Mobile Menu Button */}
            <div className="md:hidden pb-6">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card/80 backdrop-blur-sm border-border/50 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    Documentation
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-xs p-0 bg-card/95 backdrop-blur-sm border-border/50">
                  <div className="p-6">
                    <SheetHeader className="mb-6 text-left">
                      <SheetTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Documentation
                      </SheetTitle>
                    </SheetHeader>
                    <DocsSidebarNav onLinkClick={() => setOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Page Content */}
            <div>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

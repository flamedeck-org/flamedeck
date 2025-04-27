import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from "@/lib/utils"; // Assuming you have a utility for class names
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu } from 'lucide-react';

// Modify DocsSidebarNav to accept onLinkClick
interface DocsSidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  onLinkClick?: () => void; // Optional callback
}

function DocsSidebarNav({ className, onLinkClick, ...props }: DocsSidebarNavProps) {
  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <nav
      className={cn(
        "flex flex-col space-y-1",
        className
      )}
      {...props}
    >
      <NavLink
        to="/docs/getting-started"
        onClick={handleLinkClick}
        className={({ isActive }) => cn(
          "inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-accent-foreground h-10 px-4 py-2 justify-start",
          isActive ? "bg-muted hover:bg-muted" : "hover:bg-transparent hover:underline"
        )}
      >
        Getting Started
      </NavLink>
      <NavLink
        to="/docs/api"
        onClick={handleLinkClick}
        className={({ isActive }) => cn(
          "inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-accent-foreground h-10 px-4 py-2 justify-start",
          isActive ? "bg-muted hover:bg-muted" : "hover:bg-transparent hover:underline"
        )}
      >
        API Trace Upload
      </NavLink>
    </nav>
  )
}

export default function DocsLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col pt-16 bg-background"> {/* Add pt-16 for navbar offset */}
      <div className="flex-1 items-start md:grid md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] z-10">
        {/* Desktop Sidebar */}
        <aside className="fixed top-16 z-30 hidden h-[calc(100vh-4rem)] w-full shrink-0 md:sticky md:block overflow-y-auto py-6 lg:py-8 border-r px-4 bg-background">
          <DocsSidebarNav />
        </aside>
        
        {/* Apply bg-secondary to full width main, removed max-width/mx-auto */}
        <main className="relative py-6 lg:py-8 px-6 lg:px-8 bg-secondary">
          {/* New inner wrapper for max-width and centering */}
          <div className="max-w-5xl mx-auto w-full">
            {/* Mobile Menu Button */} 
            <div className="md:hidden pb-4"> 
               <Sheet open={open} onOpenChange={setOpen}>
                 <SheetTrigger asChild>
                   <Button variant="outline" size="icon" onClick={() => setOpen(true)}>
                     <Menu className="h-4 w-4" />
                     <span className="sr-only">Toggle Menu</span>
                   </Button>
                 </SheetTrigger>
                 <SheetContent side="left" className="w-full max-w-xs p-6"> 
                   <SheetHeader className="mb-4"> 
                     <SheetTitle>Navigation</SheetTitle>
                   </SheetHeader>
                   <DocsSidebarNav onLinkClick={() => setOpen(false)} />
                 </SheetContent>
               </Sheet>
            </div>

            {/* Page Content - Wrapped Outlet with padding top */} 
            <div className="pt-6">
              <Outlet /> 
            </div>
          </div> {/* End of inner max-width wrapper */}
        </main>
      </div>
    </div>
  );
} 
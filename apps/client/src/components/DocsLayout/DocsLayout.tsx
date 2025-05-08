import { memo } from "react";
import Navbar from "@/components/Navbar";

interface DocsLayoutProps {
  children: React.ReactNode;
}

function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden z-10">
      <Navbar />
      <main className="flex-1 overflow-y-auto bg-background mt-[var(--navbar-height)]">
        {children}
      </main>
    </div>
  );
}

export default memo(DocsLayout);

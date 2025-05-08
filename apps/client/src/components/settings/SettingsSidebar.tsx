import React from "react";
import { NavLink } from "react-router-dom";
import { KeyRound, User } from "lucide-react";

const SettingsSidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r bg-background flex flex-col">
      <nav className="flex-1 px-2 py-6 space-y-1">
        <h2 className="px-4 py-2 text-lg font-semibold tracking-tight">Settings</h2>
        <NavLink
          to="/settings/general"
          className={({ isActive }) =>
            `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`
          }
          aria-label="General Settings"
        >
          <User className="h-4 w-4" />
          <span>General</span>
        </NavLink>
        <NavLink
          to="/settings/api-keys"
          className={({ isActive }) =>
            `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`
          }
          aria-label="API Keys"
        >
          <KeyRound className="h-4 w-4" />
          <span>API Keys</span>
        </NavLink>
        {/* Add other settings links here */}
      </nav>
    </aside>
  );
};

export default SettingsSidebar;

import { type ElementType } from 'react';
import { NavLink } from 'react-router-dom';
import { KeyRound, User, CreditCard } from 'lucide-react';

// Define props for the new SettingsNavLink component
interface SettingsNavLinkProps {
  to: string;
  label: string;
  ariaLabel: string;
  Icon: ElementType; // lucide-react icons are components
}

// Reusable SettingsNavLink component
const SettingsNavLink: React.FC<SettingsNavLinkProps> = ({ to, label, ariaLabel, Icon }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`
      }
      aria-label={ariaLabel}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
};

const SettingsSidebar: React.FC = () => {
  return (
    <aside className="w-64 h-full border-r bg-background flex flex-col">
      <nav className="flex-1 px-2 py-6 space-y-1">
        <h2 className="px-4 py-2 text-lg font-semibold tracking-tight">Settings</h2>
        <SettingsNavLink
          to="/settings/general"
          label="General"
          ariaLabel="General Settings"
          Icon={User}
        />
        <SettingsNavLink
          to="/settings/api-keys"
          label="API Keys"
          ariaLabel="API Keys"
          Icon={KeyRound}
        />
        <SettingsNavLink
          to="/settings/billing"
          label="Billing"
          ariaLabel="Billing & Subscription"
          Icon={CreditCard}
        />
        {/* Add other settings links here using SettingsNavLink */}
      </nav>
    </aside>
  );
};

export default SettingsSidebar;

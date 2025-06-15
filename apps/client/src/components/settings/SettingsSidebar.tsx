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
        `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
          isActive
            ? 'bg-gradient-to-r from-red-500/10 to-yellow-500/10 border border-red-500/30 text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-background/80 hover:text-foreground border border-transparent hover:border-border/50'
        } backdrop-blur-sm`
      }
      aria-label={ariaLabel}
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-4 w-4 ${isActive ? 'text-red-500' : ''}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
};

const SettingsSidebar: React.FC = () => {
  return (
    <aside className="w-64 h-full border-r bg-background flex flex-col">
      <nav className="flex-1 px-4 py-6 space-y-1">
        <div className="mb-6">
          <h2 className="px-3 py-2 text-lg font-bold tracking-tight text-foreground">Settings</h2>
          <div className="w-12 h-0.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full ml-3" />
        </div>
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

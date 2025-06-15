import * as React from 'react';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SettingsSidebar from './SettingsSidebar';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, User, KeyRound, CreditCard } from 'lucide-react';

const SettingsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Get current page title based on path
  const getCurrentPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/settings/general')) return 'General';
    if (path.includes('/settings/api-keys')) return 'API Keys';
    if (path.includes('/settings/billing')) return 'Billing';
    return 'Settings';
  };

  const currentPageTitle = getCurrentPageTitle();

  return (
    <AuthGuard>
      <Layout hideNav={false} noPadding={true}>
        {/* Custom settings layout with proper height management */}
        <div className="flex h-full w-full overflow-hidden">
          {/* Desktop Sidebar - Hidden on mobile and tablet, full height */}
          <div className="hidden lg:block flex-shrink-0 w-64">
            <div className="h-full">
              <SettingsSidebar />
            </div>
          </div>

          {/* Main Content - This area scrolls independently */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 md:px-8 py-6 w-full">
              {/* Mobile Settings Navigation - Only visible on mobile/tablet */}
              <div className="lg:hidden mb-6">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-background/80 backdrop-blur-sm border border-border hover:bg-background hover:border-foreground/20 transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden group"
                    >
                      {/* Background gradient on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <span className="flex items-center gap-2 relative z-10">
                        {currentPageTitle === 'General' && (
                          <User className="h-4 w-4 text-blue-400" />
                        )}
                        {currentPageTitle === 'API Keys' && (
                          <KeyRound className="h-4 w-4 text-yellow-500" />
                        )}
                        {currentPageTitle === 'Billing' && (
                          <CreditCard className="h-4 w-4 text-green-500" />
                        )}
                        {currentPageTitle}
                      </span>
                      <ChevronDown className="h-4 w-4 relative z-10" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-[--radix-dropdown-menu-trigger-width] bg-background/95 backdrop-blur-lg border border-border shadow-xl rounded-xl p-2"
                  >
                    <DropdownMenuItem
                      onClick={() => navigate('/settings/general')}
                      icon={<User className="h-4 w-4 text-blue-400" />}
                      iconVariant="secondary"
                    >
                      General
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/settings/api-keys')}
                      icon={<KeyRound className="h-4 w-4 text-yellow-500" />}
                      iconVariant="accent"
                    >
                      API Keys
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/settings/billing')}
                      icon={<CreditCard className="h-4 w-4 text-green-500" />}
                      iconVariant="default"
                    >
                      Billing
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Content Area */}
              <div className="w-full">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
};

export default SettingsLayout;

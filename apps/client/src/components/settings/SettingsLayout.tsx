import * as React from 'react';
import { Outlet } from 'react-router-dom';
import SettingsSidebar from './SettingsSidebar';
import Layout from '@/components/Layout'; // Use the main layout for Navbar etc.
import AuthGuard from '@/components/AuthGuard';

const SettingsLayout = () => {
  return (
    <AuthGuard>
      {/* Use main Layout for overall structure like Navbar */}
      <Layout hideNav={false} noPadding={true}>
        <div className="flex h-full">
          {/* Fixed sidebar that doesn't scroll */}
          <div className="flex-shrink-0">
            <SettingsSidebar />
          </div>
          {/* Scrollable content area */}
          <div className="flex-1 h-full overflow-y-auto bg-secondary dark:bg-background">
            <div className="px-6 md:px-8 py-6 w-full">
              <Outlet /> {/* Renders the nested route's component */}
            </div>
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
};

export default SettingsLayout;

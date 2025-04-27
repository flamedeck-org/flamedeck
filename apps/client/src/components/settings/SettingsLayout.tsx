import React from 'react';
import { Outlet } from 'react-router-dom';
import SettingsSidebar from './SettingsSidebar';
import Layout from '@/components/Layout'; // Use the main layout for Navbar etc.
import PageLayout from '@/components/PageLayout'; // Use PageLayout for content structure
import AuthGuard from '@/components/AuthGuard';

const SettingsLayout: React.FC = () => {
  return (
    <AuthGuard>
      {/* Use main Layout for overall structure like Navbar */}
      <Layout hideNav={false} noPadding={true}> 
        <div className="flex h-full">
          <SettingsSidebar />
          {/* Use PageLayout for the main content area structure */}
          <PageLayout>
             {/* Add padding directly around the Outlet */}
            <div className="px-6 md:px-8 py-6 w-full h-full">
              <Outlet /> { /* Renders the nested route's component */ }
            </div>
          </PageLayout>
        </div>
      </Layout>
    </AuthGuard>
  );
};

export default SettingsLayout; 
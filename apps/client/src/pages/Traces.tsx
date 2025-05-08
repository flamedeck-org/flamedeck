import React from 'react';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import TraceList from '@/components/TraceList';

const Traces: React.FC = () => {
  return (
    <AuthGuard>
      <Layout>
        <TraceList />
      </Layout>
    </AuthGuard>
  );
};

export default Traces;

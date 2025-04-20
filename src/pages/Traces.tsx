import React from "react";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import TraceList from "@/components/TraceList";

const Traces: React.FC = () => {
  return (
    <AuthGuard>
      <Layout>
        <div>
          <TraceList />
        </div>
      </Layout>
    </AuthGuard>
  );
};

export default Traces;

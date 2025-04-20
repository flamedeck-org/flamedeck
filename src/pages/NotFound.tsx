
import React from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";

const NotFound: React.FC = () => {
  return (
    <Layout hideNav>
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <div className="space-y-6">
          <div className="text-6xl font-bold text-primary">404</div>
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="text-muted-foreground max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;

import React from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";

const NotFound: React.FC = () => {
  return (
    <Layout>
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 max-w-4xl">
          <img 
            src="/astronaut-404.png" 
            alt="Lost astronaut with a map" 
            className="w-80 h-auto md:w-96"
          />
          <div className="space-y-4 text-center md:text-left">
            <h1 className="text-3xl font-bold">Page Not Found</h1>
            <p className="text-muted-foreground max-w-md">
              Looks like you've taken a wrong turn. The page you're looking for doesn't exist or has been moved.
            </p>
            <Link to="/traces" className="inline-block pt-2">
              <Button>Back to Traces</Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;

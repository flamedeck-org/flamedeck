
import React from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import PricingTable from "@/components/PricingTable";

const Index: React.FC = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="max-w-3xl space-y-8">
          <div className="space-y-4">
            <div className="inline-block bg-primary p-3 rounded-lg mb-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-10 h-10 text-primary-foreground"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Performance Profiling
              <span className="block text-primary mt-2">
                For Engineering Teams
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload, store, and analyze performance traces with powerful visualizations.
              Debug performance issues faster than ever before.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" variant="default" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <a href="#pricing">
              <Button size="lg" variant="outline" className="text-lg px-8">
                View Pricing
              </Button>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-3xl font-bold mb-2">Upload</div>
              <p className="text-muted-foreground">
                Easily upload Speedscope-compatible JSON trace files with
                relevant metadata
              </p>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-3xl font-bold mb-2">Store</div>
              <p className="text-muted-foreground">
                Organize and search through your performance traces with rich
                metadata
              </p>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-3xl font-bold mb-2">Analyze</div>
              <p className="text-muted-foreground">
                Visualize trace data with the powerful Speedscope flame graph
                viewer
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="py-24 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-muted-foreground">
            Choose the plan that's right for you
          </p>
        </div>
        <PricingTable />
      </div>
    </Layout>
  );
};

export default Index;

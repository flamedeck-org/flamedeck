import { memo } from 'react';
// import { Helmet } from 'react-helmet-async'; // No longer directly needed here
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import PricingTable from '@/components/PricingTable';
import { UploadCloud, Database, BarChart, Search, Users, Code } from 'lucide-react';
import SharedPageSEO from '@/components/seo/SharedPageSEO';

function Index() {
  return (
    <>
      <SharedPageSEO
        pageTitle="Collaborative Performance Trace Viewer"
        description="View, analyze, and collaborate on performance profiles and trace files online with FlameDeck. Share insights and debug performance issues faster. Supports Speedscope format and more."
        path="/"
        ogType="website"
      />
      <Layout>
        {/* Hero Section */}
        <div className="min-h-[80vh] flex flex-col items-center justify-center py-24 px-4 text-center bg-gradient-to-b from-background to-background/90">
          <div className="max-w-4xl space-y-10">
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
                <span className="block bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent mt-2 pb-1">
                  For Engineering Teams
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Upload, store, and analyze performance traces with powerful visualizations. Debug
                performance issues faster than ever before with AI-powered insights.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" variant="gradient" className="text-lg px-8">
                  Get Started for Free
                </Button>
              </Link>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  View Pricing
                </Button>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="p-6 border rounded-lg bg-card text-left space-y-3">
                <UploadCloud className="h-8 w-8 text-primary mb-2" />
                <div className="text-2xl font-bold">Effortless Upload</div>
                <p className="text-muted-foreground">
                  Drag & drop traces, or integrate seamlessly with our{' '}
                  <Link to="/docs/api-keys" className="underline hover:text-primary">
                    API
                  </Link>{' '}
                  &{' '}
                  <Link to="/docs/cli-upload" className="underline hover:text-primary">
                    CLI
                  </Link>
                  . No complicated setup.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card text-left space-y-3">
                <Search className="h-8 w-8 text-primary mb-2" />
                <div className="text-2xl font-bold">AI-Driven Insights</div>
                <p className="text-muted-foreground">
                  Performance optimization is hard. Let AI analyze your traces and pinpoint key
                  issues.
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card text-left space-y-3">
                <BarChart className="h-8 w-8 text-primary mb-2" />
                <div className="text-2xl font-bold">Clear Visualizations</div>
                <p className="text-muted-foreground">
                  Understand complex data at a glance with interactive flame graphs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-24 px-4 bg-secondary/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Supercharge Your Performance Workflow
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                FlameDeck combines ease of use with powerful AI to help your team ship faster, more
                performant applications.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 border rounded-lg bg-card text-left space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                <Users className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-2xl font-semibold">Easy to Use, For Everyone</h3>
                <p className="text-muted-foreground text-lg">
                  No complicated setup, just drag, drop, and view! Or use our API/CLI for automated
                  uploads. Get insights quickly, regardless of expertise.
                </p>
              </div>
              <div className="p-8 border rounded-lg bg-card text-left space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-10 w-10 text-primary mb-3"
                >
                  <path d="M9.5 14.5A2.5 2.5 0 0 1 12 12a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 12 17a2.5 2.5 0 0 1-2.5-2.5v0Z" />
                  <path d="M12 12V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h2" />
                  <path d="M12 12V2.5A1.5 1.5 0 0 1 13.5 1a1.5 1.5 0 0 1 1.5 1.5V6h-3" />
                  <path d="M12 17v2.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 0 1.5-1.5V17h-3" />
                  <path d="M8 12H2.5A1.5 1.5 0 0 0 1 13.5A1.5 1.5 0 0 0 2.5 15H8Z" />
                  <path d="M16 12h5.5a1.5 1.5 0 0 1 1.5 1.5a1.5 1.5 0 0 1-1.5 1.5H16Z" />
                </svg>
                <h3 className="text-2xl font-semibold">AI-Assisted Optimization</h3>
                <p className="text-muted-foreground text-lg">
                  Performance tuning is complex. Leverage AI to automatically analyze traces,
                  identify bottlenecks, and get actionable recommendations.
                </p>
              </div>
              <div className="p-8 border rounded-lg bg-card text-left space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                <Code className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-2xl font-semibold">Seamless Integration</h3>
                <p className="text-muted-foreground text-lg">
                  Easily integrate trace uploading into your CI/CD pipelines, testing frameworks, or
                  applications using our robust{' '}
                  <Link to="/docs/api-keys" className="underline hover:text-primary">
                    API
                  </Link>{' '}
                  and{' '}
                  <Link to="/docs/cli-upload" className="underline hover:text-primary">
                    CLI tools
                  </Link>
                  . Explore the{' '}
                  <Link to="/docs" className="underline hover:text-primary">
                    full documentation
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div id="pricing" className="py-24 px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">Choose the plan that's right for you</p>
          </div>
          <PricingTable />
        </div>
      </Layout>
    </>
  );
}

export default memo(Index);

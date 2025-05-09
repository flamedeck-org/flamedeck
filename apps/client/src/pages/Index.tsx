import { memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import PricingTable from '@/components/PricingTable';
import { UploadCloud, Database, BarChart, Search, Users, Code } from 'lucide-react';

function Index() {
  return (
    <>
      <Helmet>
        <title>FlameDeck: Collaborative Performance Trace Viewer</title>
        <meta
          name="description"
          content="View, analyze, and collaborate on performance profiles and trace files online with FlameDeck. Share insights and debug performance issues faster. Supports Speedscope format and more."
        />
        <meta property="og:title" content="FlameDeck: Collaborative Performance Trace Viewer" />
        <meta
          property="og:description"
          content="View, analyze, and collaborate on performance profiles and trace files online with FlameDeck."
        />
        <meta property="og:type" content="website" />
        {/* <meta property="og:image" content="YOUR_FLAMEDECK_IMAGE_URL_HERE.png" /> */}
        {/* If you have a general OG image, uncomment the line above and provide the URL */}
        {/* The og:url should be the canonical URL for this specific page. 
            For the index page, it's usually the root domain. 
            It's often better to set this dynamically if your site is deployed to multiple URLs (e.g., previews) or for other pages. 
            For now, I'll leave the placeholder as it requires the actual domain which might not be in index.html or might need to be dynamic. */}
        <meta property="og:url" content="https://www.flamedeck.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@flamedeckapp" />
        <meta name="twitter:title" content="FlameDeck: Collaborative Performance Trace Viewer" />
        <meta
          name="twitter:description"
          content="View, analyze, and collaborate on performance profiles and trace files online with FlameDeck."
        />
        {/* <meta name="twitter:image" content="YOUR_FLAMEDECK_IMAGE_URL_HERE.png" /> */}
        {/* If you have a general Twitter image, uncomment the line above and provide the URL */}
      </Helmet>
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
                performance issues faster than ever before.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" variant="gradient" className="text-lg px-8">
                  Get Started
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
                <div className="text-2xl font-bold">Upload</div>
                <p className="text-muted-foreground">
                  Easily upload Speedscope-compatible JSON trace files with relevant metadata
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card text-left space-y-3">
                <Database className="h-8 w-8 text-primary mb-2" />
                <div className="text-2xl font-bold">Store</div>
                <p className="text-muted-foreground">
                  Organize and search through your performance traces with rich metadata
                </p>
              </div>
              <div className="p-6 border rounded-lg bg-card text-left space-y-3">
                <BarChart className="h-8 w-8 text-primary mb-2" />
                <div className="text-2xl font-bold">Analyze</div>
                <p className="text-muted-foreground">
                  Visualize trace data with the powerful Speedscope flame graph viewer
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
                Powerful Features for Performance Analysis
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Streamline your performance debugging workflow with tools built for teams.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 border rounded-lg bg-card text-left space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                <Search className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-2xl font-semibold">Centralized Trace Storage</h3>
                <p className="text-muted-foreground text-lg">
                  Securely store and organize all your performance traces in one accessible
                  location. Easily search and retrieve profiles when you need them.
                </p>
              </div>
              <div className="p-8 border rounded-lg bg-card text-left space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                <Users className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-2xl font-semibold">Collaborative Debugging</h3>
                <p className="text-muted-foreground text-lg">
                  Dive deep into performance issues with an interactive flamegraph viewer. Share
                  insights and collaborate with your team directly on the trace data.
                </p>
              </div>
              <div className="p-8 border rounded-lg bg-card text-left space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                <Code className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-2xl font-semibold">API Integration</h3>
                <p className="text-muted-foreground text-lg">
                  Seamlessly integrate trace uploading into your CI/CD pipelines or automated
                  testing frameworks using our simple API.
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

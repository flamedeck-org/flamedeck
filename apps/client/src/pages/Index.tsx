import { memo, useEffect, useState, useCallback } from 'react';
// import { Helmet } from 'react-helmet-async'; // No longer directly needed here
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import PricingTable from '@/components/PricingTable';
import { UploadCloud, Database, BarChart, Search, Users, Code, FileCode } from 'lucide-react';
import SharedPageSEO from '@/components/seo/SharedPageSEO';
import { useAtom } from '@/lib/speedscope-core/atom';
import { colorSchemeAtom, ColorScheme } from '@/components/speedscope-ui/theme';
import {
  SiRust,
  SiNodedotjs,
  SiGooglechrome,
  SiGo,
  SiPython,
  SiReact,
} from '@icons-pack/react-simple-icons';
import FadeInOnScroll from '@/components/animations/FadeInOnScroll';

function matchMediaDarkColorScheme(): MediaQueryList {
  return matchMedia('(prefers-color-scheme: dark)');
}

function Index() {
  const [systemPrefersDarkMode, setSystemPrefersDarkMode] = useState(
    () => matchMediaDarkColorScheme().matches
  );

  const matchMediaListener = useCallback(
    (event: MediaQueryListEvent) => {
      setSystemPrefersDarkMode(event.matches);
    },
    [setSystemPrefersDarkMode]
  );

  useEffect(() => {
    const media = matchMediaDarkColorScheme();
    media.addEventListener('change', matchMediaListener);
    return () => {
      media.removeEventListener('change', matchMediaListener);
    };
  }, [matchMediaListener]);

  const colorScheme = useAtom(colorSchemeAtom);
  const isDarkMode =
    colorScheme === ColorScheme.DARK ||
    (colorScheme === ColorScheme.SYSTEM && systemPrefersDarkMode);

  const screenshotPath = isDarkMode
    ? '/screenshots/homescreen_pro_dark.png'
    : '/screenshots/homescreen_pro_light.png';

  const aiScreenshotPath = isDarkMode
    ? '/screenshots/chat_dark.png'
    : '/screenshots/chat_light.png';

  const pageFooter = (
    <footer className="bg-background py-8 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} FlameDeck. All rights reserved.
        </p>
        <div className="flex space-x-6">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Login
          </Link>
          <Link to="/docs/api-keys" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            API Docs
          </Link>
          {/* Add more links here if needed */}
        </div>
      </div>
    </footer>
  );

  return (
    <>
      <SharedPageSEO
        pageTitle="Collaborative Performance Trace Viewer"
        description="View, analyze, and collaborate on performance profiles and trace files online with FlameDeck. Share insights and debug performance issues faster. Supports Speedscope format and more."
        path="/"
        ogType="website"
      />
      <Layout footer={pageFooter}>
        <FadeInOnScroll>
          {/* Hero Section - entire content now wrapped */}
          <div className="min-h-[80vh] flex flex-col items-center justify-center py-24 px-4 text-center rounded-3xl">
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
                  Performance Debugging
                  <span className="block bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent mt-2 pb-1">
                    Made Simple
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
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.2}>
          {/* Features Section - entire content now wrapped */}
          <div className="py-24 px-4 bg-background dark:bg-secondary/50 rounded-3xl border border-border">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Why FlameDeck?
                </h2>
                {/* <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  FlameDeck combines ease of use with powerful AI to help your team ship faster, more
                  performant applications.
                </p> */}
              </div>

              {/* Feature 1: Store and Manage */}
              <div className="grid md:grid-cols-5 gap-12 items-stretch mb-24">
                <div className="space-y-4 md:col-span-2">
                  <Database className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-3xl font-bold">Store and Manage Performance Profiles</h3>
                  <p className="text-xl text-muted-foreground">
                    Keeping track of profiles when debugging issues with your application is messy and
                    confusing. Organize them all in one place with FlameDeck, making it easy to find
                    what you need, when you need it.
                  </p>
                </div>
                <div className="bg-card rounded-lg shadow-lg flex items-center justify-center overflow-hidden md:col-span-3 border border-border">
                  <img
                    src={screenshotPath}
                    alt="FlameDeck homescreen showing trace management"
                    className="object-contain w-full"
                  />
                </div>
              </div>

              {/* Feature 2: Analyze with AI */}
              <div className="grid md:grid-cols-5 gap-12 items-stretch mb-24">
                <div className="bg-card rounded-lg shadow-lg flex items-center justify-center overflow-hidden md:order-first md:col-span-3 border border-border">
                  <img
                    src={aiScreenshotPath}
                    alt="FlameDeck AI chat analyzing a performance trace"
                    className="object-contain w-full"
                  />
                </div>
                <div className="space-y-4 md:order-last md:col-span-2">
                  <Search className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-3xl font-bold">Analyze with AI</h3>
                  <p className="text-xl text-muted-foreground">
                    Performance debugging is hard and time-consuming. FlameDeck uses state-of-the-art
                    AI models to analyze your performance profiles, pinpoint bottlenecks, and provide
                    actionable insights.
                  </p>
                </div>
              </div>

              {/* Feature 3: Bring Any Profile */}
              <div className="grid md:grid-cols-5 gap-12 items-stretch">
                <div className="space-y-4 md:col-span-2">
                  <UploadCloud className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-3xl font-bold">Bring Any Profile</h3>
                  <p className="text-xl text-muted-foreground">
                    FlameDeck supports a wide range of profiling formats from various languages and
                    runtimes. Seamlessly import profiles from Node.js, Chrome, React Native, Go,
                    Rust, and more.
                  </p>
                </div>
                <div className="bg-card rounded-lg shadow-lg flex items-center justify-center overflow-hidden md:col-span-3 border border-border p-6">
                  <div className="grid grid-cols-3 gap-4 w-full">
                    {[
                      { name: 'Node.js', icon: SiNodedotjs as React.ElementType },
                      { name: 'Chrome', icon: SiGooglechrome as React.ElementType },
                      { name: 'Rust', icon: SiRust as React.ElementType },
                      { name: 'Go', icon: SiGo as React.ElementType },
                      { name: 'Python', icon: SiPython as React.ElementType },
                      { name: 'React Native', icon: SiReact as React.ElementType },
                      // If we had a FileCode example still, it would be:
                      // { name: 'Generic File', icon: FileCode as React.ElementType },
                    ].map((lang) => (
                      <div key={lang.name} className="flex flex-col items-center p-3 bg-background rounded-md space-y-2">
                        <lang.icon className="h-8 w-8 text-primary" />
                        <span className="text-sm text-center text-muted-foreground">{lang.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.4}>
          {/* Pricing Section - entire content now wrapped */}
          <div id="pricing" className="py-24 px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
              <p className="text-xl text-muted-foreground">Choose the plan that's right for you</p>
            </div>
            <PricingTable />
          </div>
        </FadeInOnScroll>
      </Layout>
    </>
  );
}

export default memo(Index);

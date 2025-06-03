import { memo, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import PricingTable from '@/components/PricingTable';
import { UploadCloud, Database, BarChart, Search, ArrowRight, Star, ExternalLink } from 'lucide-react';
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
    <footer className="bg-background/80 backdrop-blur-lg py-12 px-4 sm:px-6 lg:px-8 border-t border-border/50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} FlameDeck. All rights reserved.
        </p>
        <div className="flex space-x-8">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-105">
            Login
          </Link>
          <a
            href="https://docs.flamedeck.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-105 inline-flex items-center gap-1"
          >
            API Docs
            <ExternalLink className="w-3 h-3" />
          </a>
          <a href="mailto:support@flamedeck.com" className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-105">
            Support
          </a>
          <a href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-105">
            Privacy Policy
          </a>
          <a href="#" className="termly-display-preferences text-sm text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-105">
            Consent Preferences
          </a>
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
        {/* Background Elements */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-50/30 via-background to-yellow-50/30 dark:from-red-950/20 dark:via-background dark:to-yellow-950/20" />
          <div className="absolute top-1/4 -right-64 w-96 h-96 bg-gradient-to-br from-red-400/20 to-yellow-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -left-64 w-96 h-96 bg-gradient-to-br from-yellow-400/20 to-red-400/20 rounded-full blur-3xl" />
        </div>

        <FadeInOnScroll>
          {/* Hero Section */}
          <div className="min-h-[70vh] flex flex-col items-center justify-center py-12 md:py-16 px-4 text-center relative">
            <div className="max-w-5xl space-y-8 md:space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 md:px-4 py-2 md:py-2 rounded-full bg-gradient-to-r from-red-500/10 to-yellow-500/10 border border-red-500/20 text-sm md:text-sm font-medium text-foreground backdrop-blur-sm">
                <Star className="w-4 h-4 md:w-4 md:h-4 text-yellow-500" />
                <span>AI-Powered Performance Analysis</span>
              </div>

              {/* Main Hero Content */}
              <div className="space-y-6 md:space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent blur-sm opacity-30">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight">
                      Performance Debugging
                      <span className="block mt-1">Made Simple</span>
                    </h1>
                  </div>
                  <h1 className="relative text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight">
                    Performance Debugging
                    <span className="block bg-gradient-to-r from-red-500 via-red-400 to-yellow-500 bg-clip-text text-transparent mt-1">
                      Made Simple
                    </span>
                  </h1>
                </div>

                <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light px-4 md:px-0">
                  Upload, store, and analyze performance traces with powerful visualizations.
                  <span className="block mt-2 font-medium bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                    Debug performance issues faster than ever with AI-powered insights.
                  </span>
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 md:gap-4 justify-center items-center pt-2">
                <Link to="/login" className="group">
                  <Button
                    size="lg"
                    className="text-lg md:text-lg px-8 md:px-8 py-3 md:py-3 bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white shadow-2xl shadow-red-500/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-3xl group-hover:shadow-red-500/40"
                  >
                    Get Started for Free
                    <ArrowRight className="ml-2 w-5 h-5 md:w-5 md:h-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <a href="#pricing" className="group">
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg md:text-lg px-8 md:px-8 py-3 md:py-3 border-2 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
                  >
                    View Pricing
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </FadeInOnScroll>

        {/* Feature Cards Section - moved outside hero */}
        <FadeInOnScroll delay={0.1}>
          <div className="py-8 md:py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {[
                  {
                    icon: UploadCloud,
                    title: "Effortless Upload",
                    description: "Drag & drop traces, or integrate seamlessly with our API & CLI. No complicated setup.",
                    links: [
                      { text: "API", to: "https://docs.flamedeck.com/api-keys" },
                      { text: "CLI", to: "https://docs.flamedeck.com/cli-upload" }
                    ],
                    accent: "from-red-500 to-red-600",
                    bg: "from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20"
                  },
                  {
                    icon: Search,
                    title: "AI-Driven Insights",
                    description: "Performance optimization is hard. Let AI analyze your traces and pinpoint key issues.",
                    accent: "from-blue-500 to-blue-600",
                    bg: "from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20"
                  },
                  {
                    icon: BarChart,
                    title: "Clear Visualizations",
                    description: "Understand complex data at a glance with interactive flame graphs.",
                    accent: "from-green-500 to-green-600",
                    bg: "from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20"
                  }
                ].map((feature, index) => (
                  <div
                    key={feature.title}
                    className={`relative p-6 md:p-8 bg-gradient-to-br ${feature.bg} border border-border/30 rounded-3xl shadow-sm`}
                  >
                    {/* Subtle accent line */}
                    <div className={`absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r ${feature.accent} rounded-full`} />

                    <div className="flex flex-col items-start text-left space-y-4 md:space-y-5">
                      <div className={`p-3 md:p-4 bg-gradient-to-br ${feature.accent} rounded-2xl shadow-sm`}>
                        <feature.icon className="h-6 w-6 md:h-7 md:w-7 text-white" />
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-lg md:text-xl font-bold text-foreground">{feature.title}</h3>
                        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                          {feature.description.split(/(\bAPI\b|\bCLI\b)/).map((part, i) => {
                            if (part === 'API' && feature.links) {
                              return (
                                <a
                                  key={i}
                                  href={feature.links[0].to}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline decoration-primary/30 underline-offset-2 font-medium inline-flex items-center gap-1"
                                >
                                  {part}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              );
                            }
                            if (part === 'CLI' && feature.links) {
                              return (
                                <a
                                  key={i}
                                  href={feature.links[1].to}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline decoration-primary/30 underline-offset-2 font-medium inline-flex items-center gap-1"
                                >
                                  {part}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              );
                            }
                            return part;
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Subtle corner decoration */}
                    <div className="absolute bottom-4 right-4 w-8 h-8 opacity-10">
                      <div className={`w-full h-full bg-gradient-to-br ${feature.accent} rounded-full`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.2}>
          {/* Features Section */}
          <div className="py-16 md:py-32 px-4 relative">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12 md:mb-20">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6">
                  Why Choose FlameDeck?
                </h2>
                <div className="w-20 h-1 bg-gradient-to-r from-red-500 to-yellow-500 mx-auto rounded-full" />
              </div>

              {/* Feature 1: Store and Manage */}
              <div className="grid lg:grid-cols-5 gap-8 md:gap-16 items-center mb-16 md:mb-32">
                <div className="space-y-4 md:space-y-6 lg:col-span-2">
                  <div className="inline-flex p-3 md:p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl border border-blue-500/20">
                    <Database className="h-8 w-8 md:h-12 md:w-12 text-blue-500" />
                  </div>
                  <h3 className="text-2xl md:text-4xl font-bold leading-tight">
                    Store and Manage
                    <span className="block text-blue-500">Performance Profiles</span>
                  </h3>
                  <p className="text-base md:text-xl text-muted-foreground leading-relaxed">
                    Keeping track of profiles when debugging issues with your application is messy and
                    confusing. Organize them all in one place with FlameDeck, making it easy to find
                    what you need, when you need it.
                  </p>
                </div>
                <div className="lg:col-span-3">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl md:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                    <div className="relative bg-card/80 backdrop-blur-xl rounded-xl md:rounded-3xl shadow-2xl border border-border/50 overflow-hidden group-hover:shadow-3xl transition-all duration-500">
                      <img
                        src={screenshotPath}
                        alt="FlameDeck homescreen showing trace management"
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 2: Analyze with AI */}
              <div className="grid lg:grid-cols-5 gap-8 md:gap-16 items-center mb-16 md:mb-32">
                <div className="space-y-4 md:space-y-6 lg:col-span-2 lg:order-last">
                  <div className="inline-flex p-3 md:p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/20">
                    <Search className="h-8 w-8 md:h-12 md:w-12 text-green-500" />
                  </div>
                  <h3 className="text-2xl md:text-4xl font-bold leading-tight">
                    Analyze with
                    <span className="block text-green-500">AI</span>
                  </h3>
                  <p className="text-base md:text-xl text-muted-foreground leading-relaxed">
                    Performance debugging is hard and time-consuming. FlameDeck uses state-of-the-art
                    AI models to analyze your performance profiles, pinpoint bottlenecks, and provide
                    actionable insights.
                  </p>
                </div>
                <div className="lg:col-span-3 lg:order-first">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl md:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                    <div className="relative bg-card/80 backdrop-blur-xl rounded-xl md:rounded-3xl shadow-2xl border border-border/50 overflow-hidden group-hover:shadow-3xl transition-all duration-500">
                      <img
                        src={aiScreenshotPath}
                        alt="FlameDeck AI chat analyzing a performance trace"
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 3: Bring Any Profile */}
              <div className="grid lg:grid-cols-5 gap-8 md:gap-16 items-center">
                <div className="space-y-4 md:space-y-6 lg:col-span-2">
                  <div className="inline-flex p-3 md:p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20">
                    <UploadCloud className="h-8 w-8 md:h-12 md:w-12 text-purple-500" />
                  </div>
                  <h3 className="text-2xl md:text-4xl font-bold leading-tight">
                    Bring Any
                    <span className="block text-purple-500">Profile</span>
                  </h3>
                  <p className="text-base md:text-xl text-muted-foreground leading-relaxed">
                    FlameDeck supports a wide range of profiling formats from various languages and
                    runtimes. Seamlessly import profiles from Node.js, Chrome, React Native, Go,
                    Rust, and more.
                  </p>
                </div>
                <div className="lg:col-span-3">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl md:rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                    <div className="relative bg-card/80 backdrop-blur-xl rounded-xl md:rounded-3xl shadow-2xl border border-border/50 p-6 md:p-10 group-hover:shadow-3xl transition-all duration-500">
                      <div className="grid grid-cols-3 gap-3 md:gap-6">
                        {[
                          { name: 'Node.js', icon: SiNodedotjs as React.ElementType, color: 'text-green-500' },
                          { name: 'Chrome', icon: SiGooglechrome as React.ElementType, color: 'text-blue-500' },
                          { name: 'Rust', icon: SiRust as React.ElementType, color: 'text-orange-500' },
                          { name: 'Go', icon: SiGo as React.ElementType, color: 'text-cyan-500' },
                          { name: 'Python', icon: SiPython as React.ElementType, color: 'text-yellow-500' },
                          { name: 'React Native', icon: SiReact as React.ElementType, color: 'text-blue-400' },
                        ].map((lang) => (
                          <div
                            key={lang.name}
                            className="group/lang flex flex-col items-center p-3 md:p-6 bg-background/50 backdrop-blur-sm rounded-2xl border border-border/30 hover:border-border/60 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                          >
                            <lang.icon className={`h-6 w-6 md:h-10 md:w-10 ${lang.color} mb-2 md:mb-3 transition-transform group-hover/lang:scale-110`} />
                            <span className="text-xs md:text-sm font-medium text-center text-muted-foreground group-hover/lang:text-foreground transition-colors">
                              {lang.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.4}>
          {/* Pricing Section */}
          <div id="pricing" className="py-16 md:py-32 px-4 bg-gradient-to-br from-background/50 to-secondary/30 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12 md:mb-16">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6">
                  Simple, Transparent Pricing
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground">Choose the plan that's right for you</p>
                <div className="w-20 h-1 bg-gradient-to-r from-red-500 to-yellow-500 mx-auto rounded-full mt-4 md:mt-6" />
              </div>
              <PricingTable />
            </div>
          </div>
        </FadeInOnScroll>
      </Layout>
    </>
  );
}

export default memo(Index);

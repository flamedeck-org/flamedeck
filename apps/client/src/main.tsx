import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://04fc875675ab756acc66d38a2006fa0b@o151703.ingest.us.sentry.io/4509277364551680',
  sendDefaultPii: true,
});

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Import highlight.js themes
import 'highlight.js/styles/github.css'; // Default (light) theme
import 'highlight.js/styles/github-dark.css'; // Dark theme
import { ThemeProvider as SpeedscopeThemeProvider } from './components/speedscope-ui/themes/theme'; // Renamed for clarity
// Import ThemeProvider from next-themes
import { ThemeProvider as NextThemesProvider } from 'next-themes';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Use next-themes provider to control Tailwind dark class */}
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Keep the original Speedscope provider for its specific needs */}
      <SpeedscopeThemeProvider>
        <App />
      </SpeedscopeThemeProvider>
    </NextThemesProvider>
  </React.StrictMode>
);

import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://69be43f62cf4b4d559458e07a9bfc90c@o4509312933822464.ingest.us.sentry.io/4509312934084608',

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});

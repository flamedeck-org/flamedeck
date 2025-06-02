# FlameDeck Documentation

This directory contains the FlameDeck documentation built with Mintlify.

## Local Development

Run the documentation locally for development:

```bash
# From the root of the project
yarn nx run docs:dev

# Or from this directory
yarn mintlify dev
```

## Deployment Setup

The documentation is hosted on Mintlify and served at `flamedeck.com/docs` via Vercel proxy.

### Steps to Deploy:

1. **Push to GitHub**: Ensure this docs directory is in your main repository
2. **Connect to Mintlify**:
   - Go to [Mintlify Dashboard](https://dashboard.mintlify.com)
   - Connect your GitHub repository
   - Point to the `apps/docs` directory
   - Set subdomain to `flamedeck`

3. **Configure Custom Domain** (Optional):
   - In Mintlify dashboard, go to Settings > Custom Domain
   - This step is optional since we're using Vercel proxy

4. **Deploy Main App**:
   - Deploy your main app to Vercel as usual
   - The `vercel.json` configuration will automatically proxy `/docs` requests to Mintlify

### How it Works

- Documentation source files are in this directory
- Mintlify automatically builds and hosts the docs when you push to GitHub
- Vercel proxies requests from `flamedeck.com/docs/*` to `flamedeck.mintlify.dev/docs/*`
- Users see the docs at your custom domain seamlessly

### Files Structure

- `mint.json` - Mintlify configuration
- `*.mdx` - Documentation pages
- `public/` - Static assets (logos, images, etc.)

## Benefits

- ✅ **Free hosting** on Mintlify
- ✅ **Custom domain** via Vercel proxy
- ✅ **Automatic deployments** when you push to GitHub
- ✅ **Local development** with `mintlify dev`
- ✅ **Beautiful UI** out of the box
- ✅ **Search functionality** included
- ✅ **Analytics** and insights from Mintlify 
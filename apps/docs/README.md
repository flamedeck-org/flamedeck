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

The documentation is hosted on Mintlify at `docs.flamedeck.com` using a custom domain.

### Steps to Deploy:

1. **Push to GitHub**: Ensure this docs directory is in your main repository

2. **Connect to Mintlify**:
   - Go to [Mintlify Dashboard](https://dashboard.mintlify.com)
   - Connect your GitHub repository
   - Point to the `apps/docs` directory
   - Set subdomain to `flamedeck`

3. **Configure Custom Domain**:
   - In Mintlify dashboard, go to Settings > Custom Domain
   - Enter `docs.flamedeck.com`
   - Follow the DNS instructions provided by Mintlify
   - Add CNAME record: `docs.flamedeck.com` → `cname.mintlify.dev`

4. **Update DNS**:
   - In your domain provider (where flamedeck.com is hosted)
   - Add the CNAME record as instructed by Mintlify
   - Wait for DNS propagation (usually 5-30 minutes)

### How it Works

- Documentation source files are in this directory
- Mintlify automatically builds and hosts the docs when you push to GitHub
- Users access docs directly at `docs.flamedeck.com`
- No proxy or subpath configuration needed

### Files Structure

- `mint.json` - Mintlify configuration
- `*.mdx` - Documentation pages
- `public/` - Static assets (logos, images, etc.)

## Benefits

- ✅ **Free hosting** on Mintlify's CDN
- ✅ **Custom subdomain** at `docs.flamedeck.com`
- ✅ **Automatic deployments** when you push to GitHub
- ✅ **Local development** with `mintlify dev`
- ✅ **Beautiful UI** out of the box
- ✅ **Search functionality** included
- ✅ **Analytics** and insights from Mintlify
- ✅ **SSL certificate** automatically managed by Mintlify 
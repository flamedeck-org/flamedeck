# Performance Testing Demo

This is a quick demo of how to use the performance regression testing system.

## 🚀 Quick Demo Commands

### 1. Check Current Performance (Baseline)
```bash
# This will show you current performance metrics without failing
yarn nx performance:baseline client
```

### 2. Test Against Main Branch (Local Regression)
```bash
# This compares your current branch against main and only fails on statistical regressions
yarn nx performance:compare client
```

### 3. Quick Test (Development)
```bash
# Faster test with fewer scenarios for quick iteration
yarn nx performance:compare-quick client
```

## 📊 What You'll See

### Baseline Collection Output
```
📊 Collecting baseline performance metrics...

🧪 Testing scenario: homepage
📍 URL: http://localhost:3000
📊 Metrics for homepage:
  ttfb: 45.23ms
  fcp: 892.15ms
  lcp: 1205.67ms
  domContentLoaded: 1156.34ms
  loadComplete: 1298.45ms

✅ Baseline collection complete
```

### Local Regression Test Output
```
🚀 Starting Performance Regression Testing
📊 Configuration:
   Base: main
   Iterations: 5
   Scenarios: homepage, dashboard
   Mode: Local

🔄 Switching to base: main
📦 Installing dependencies for base...
🏗️ Building base version...
🔄 Switching back to current version...
📦 Installing dependencies for current...
🏗️ Building current version...
🚀 Starting static servers...
📍 Base server: http://localhost:3001
📍 Current server: http://localhost:3002
⚡ Running performance regression tests...

=== Local Performance Report ===

## Performance Comparison Report

**Summary:**
- Total scenarios tested: 2
- Total metrics compared: 8
- Regressions: 0
- Improvements: 1
- Neutral: 7

**✅ Improvements Found:**
- homepage:
  - LCP: -8.5% (p=0.023)

🛑 Stopping static servers...
✅ No performance regressions found
```

## 🎯 Key Points

1. **Only fails on statistical significance**: You won't get false positives from environmental noise
2. **Automatic environment management**: The script handles switching branches, building, and cleanup
3. **Comprehensive metrics**: Tests Core Web Vitals and other important performance indicators
4. **Works with any branch**: Compare against main, develop, or any commit
5. **CI-ready**: Same framework works in GitHub Actions

## 🔧 Customization Examples

```bash
# Compare against develop branch
yarn nx performance:compare-vs-develop client

# Test specific scenarios only
node e2e/scripts/run-performance-regression.js --scenarios homepage,dashboard

# More iterations for higher confidence
node e2e/scripts/run-performance-regression.js --iterations 10

# Get help
node e2e/scripts/run-performance-regression.js --help
```

## 🚨 When Tests Fail

Tests only fail when there's a statistically significant performance regression:

```
❌ Performance regression detected! 1 metrics regressed: TBT

Performance regression detected in homepage: TBT (p=0.003, effect=0.847)
```

This means your changes made the page significantly slower in a measurable way, not just random variation.

## 📝 Next Steps

1. Try the baseline command to see current performance
2. Make a small change to your code  
3. Run the quick regression test to see the comparison
4. Use this in your development workflow before creating PRs 